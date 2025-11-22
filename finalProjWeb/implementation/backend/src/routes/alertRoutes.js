const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { authenticateJWT, authorize } = require('../middleware/auth');

/**
 * Alert Management Routes
 * Base path: /api/v1/alerts and /api/v1/patients/:patient_id/thresholds
 */

// GET /api/v1/alerts - Get active alerts
router.get('/', authenticateJWT, authorize('nurse', 'admin'), alertController.getAlerts);

// PATCH /api/v1/alerts/:alert_id/acknowledge - Acknowledge alert
router.patch('/:alert_id/acknowledge', authenticateJWT, authorize('nurse', 'admin'), alertController.acknowledgeAlert);

// Export for use in server.js
module.exports = {
  alertRoutes: router,
  getThresholds: alertController.getThresholds,
  updateThresholds: alertController.updateThresholds
};
