const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');
const { authenticateJWT, authorize } = require('../middleware/auth');

/**
 * Sensor Data Routes
 * Base path: /api/v1/sensors
 */

// POST /api/v1/sensors/data - Ingest sensor reading (called by sensors, no auth for now)
// In production, this would use API keys or sensor-specific authentication
router.post('/data', sensorController.ingestSensorData);

// POST /api/v1/sensors/alert - Receive alert from sensor (no auth for now)
router.post('/alert', sensorController.receiveAlert);

// GET /api/v1/sensors/:sensor_id/readings - Get recent readings (requires auth)
router.get('/:sensor_id/readings', authenticateJWT, authorize('nurse', 'admin'), sensorController.getSensorReadings);

module.exports = router;
