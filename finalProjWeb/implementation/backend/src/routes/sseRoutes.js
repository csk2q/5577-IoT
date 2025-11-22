/**
 * SSE (Server-Sent Events) Routes
 * 
 * Provides real-time streaming of sensor data, alerts, and status updates.
 * Clients connect via EventSource and receive live updates as they occur.
 */

const express = require('express');
const db = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Store active SSE connections
const clients = new Map();

/**
 * GET /stream/sensor-data
 * 
 * EventSource endpoint for real-time sensor data streaming.
 * Sends sensor readings, alerts, and status updates to connected clients.
 */
router.get('/sensor-data', (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Generate unique client ID
  const clientId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  
  logger.info(`SSE client connected: ${clientId}`);

  // Store client connection
  clients.set(clientId, res);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    clientId,
    timestamp: new Date().toISOString()
  })}\n\n`);

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
      client.write(message);
      successCount++;
    } catch (error) {
      logger.error(`Failed to send to client ${clientId}:`, error);
      clients.delete(clientId);
      failCount++;
    }
  });

  if (successCount > 0 || failCount > 0) {
    logger.debug(`Broadcast ${event.type}: ${successCount} delivered, ${failCount} failed`);
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
