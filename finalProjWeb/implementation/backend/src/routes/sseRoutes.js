/**
 * SSE (Server-Sent Events) Routes
 * 
 * Provides real-time streaming of sensor data, alerts, and status updates.
 * Clients connect via EventSource and receive live updates as they occur.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Store active SSE connections with user context
const clients = new Map();

// Connection limits per user
const MAX_CONNECTIONS_PER_USER = 5;

/**
 * SSE Authentication Middleware
 * EventSource doesn't support custom headers, so we accept token via query param
 */
function authenticateSSE(req, res, next) {
  try {
    // Try to get token from query parameter (EventSource limitation)
    const token = req.query.token;

    if (!token) {
      logger.warn('SSE connection attempt without token');
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_TOKEN_MISSING',
          message: 'Authentication token required in query parameter'
        }
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('SSE JWT verification failed:', err.message);
    
    const errorCode = err.name === 'TokenExpiredError' 
      ? 'AUTH_TOKEN_EXPIRED' 
      : 'AUTH_TOKEN_INVALID';

    return res.status(401).json({
      success: false,
      error: {
        code: errorCode,
        message: 'Invalid or expired token'
      }
    });
  }
}

/**
 * GET /stream/sensor-data
 * 
 * EventSource endpoint for real-time sensor data streaming.
 * Sends sensor readings, alerts, and status updates to connected clients.
 * 
 * Authentication: Requires JWT token as query parameter (?token=...)
 * Authorization: Available to all authenticated users
 */
router.get('/sensor-data', authenticateSSE, (req, res) => {
  const origin = req.get('origin');
  
  // Check connection limit for this user
  const userConnections = Array.from(clients.values())
    .filter(client => client.userId === req.user.user_id);
  
  if (userConnections.length >= MAX_CONNECTIONS_PER_USER) {
    logger.warn(`User ${req.user.user_id} exceeded connection limit`);
    return res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_CONNECTIONS',
        message: `Maximum ${MAX_CONNECTIONS_PER_USER} concurrent connections allowed`
      }
    });
  }
  
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // CRITICAL: Write headers immediately to establish connection
  res.flushHeaders();

  // Generate unique client ID
  const clientId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  
  logger.info(`SSE client connected - User: ${req.user.employee_id} (${req.user.role}), ClientId: ${clientId}`);

  // Store client connection with user context
  clients.set(clientId, {
    response: res,
    userId: req.user.user_id,
    employee_id: req.user.employee_id,
    role: req.user.role,
    connectedAt: new Date()
  });

  // Send initial connection message and flush immediately
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    clientId,
    timestamp: new Date().toISOString()
  })}\n\n`);
  
  // Force flush the initial message
  if (res.flush) res.flush();

  // Setup heartbeat to keep connection alive (every 30 seconds)
  const heartbeat = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
    logger.info(`SSE client disconnected: ${clientId}`);
  });
});

/**
 * Broadcast sensor reading to all connected clients
 * Called from sensorController when new data is received
 */
function broadcastSensorReading(sensorData) {
  const event = {
    type: 'sensor_reading',
    data: sensorData,
    timestamp: new Date().toISOString()
  };

  broadcast(event);
}

/**
 * Broadcast sensor status change to all connected clients
 * Called when sensor goes offline or comes back online
 */
function broadcastSensorStatus(statusData) {
  const event = {
    type: 'sensor_status',
    data: statusData,
    timestamp: new Date().toISOString()
  };

  broadcast(event);
}

/**
 * Broadcast alert to all connected clients
 * Called from alertController when alert is triggered
 */
function broadcastAlert(alertData) {
  const event = {
    type: 'alert_triggered',
    data: alertData,
    timestamp: new Date().toISOString()
  };

  broadcast(event);
}

/**
 * Broadcast alert acknowledgment to all connected clients
 */
function broadcastAlertAcknowledged(alertData) {
  const event = {
    type: 'alert_acknowledged',
    data: alertData,
    timestamp: new Date().toISOString()
  };

  broadcast(event);
}

/**
 * Generic broadcast function to send event to all connected clients
 */
function broadcast(event) {
  const message = `data: ${JSON.stringify(event)}\n\n`;
  
  let successCount = 0;
  let failCount = 0;

  clients.forEach((client, clientId) => {
    try {
      client.response.write(message);
      // CRITICAL: Force flush to send immediately
      if (client.response.flush) {
        client.response.flush();
      }
      successCount++;
    } catch (error) {
      logger.error(`Failed to send to client ${clientId}:`, error);
      clients.delete(clientId);
      failCount++;
    }
  });

  // Log broadcasts for debugging
  if (successCount > 0) {
    logger.info(`Broadcast ${event.type}: ${successCount} clients notified`);
  }
  if (failCount > 0) {
    logger.warn(`Broadcast ${event.type}: ${failCount} clients failed`);
  }
}

/**
 * Get count of connected clients (for monitoring)
 */
function getClientCount() {
  return clients.size;
}

module.exports = {
  router,
  broadcastSensorReading,
  broadcastSensorStatus,
  broadcastAlert,
  broadcastAlertAcknowledged,
  getClientCount
};
