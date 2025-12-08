const db = require('../config/database');
const logger = require('../utils/logger');
const { broadcastAlert, broadcastAlertAcknowledged } = require('../routes/sseRoutes');

/**
 * Alert Management Controller
 * Handles alert retrieval, acknowledgment, and threshold management
 */

/**
 * Get active alerts with optional filters
 * GET /api/v1/alerts
 */
const getAlerts = async (req, res) => {
  try {
    const {
      patient_id,
      acknowledged = 'false',
      limit = 50,
      page = 1
    } = req.query;

    const offset = (page - 1) * limit;

    // Build WHERE clause
    let whereConditions = [];
    let queryParams = [];

    if (patient_id) {
      whereConditions.push('p.patient_identifier = ?');
      queryParams.push(patient_id);
    }

    if (acknowledged === 'true') {
      whereConditions.push('a.acknowledged = true');
    } else if (acknowledged === 'false') {
      whereConditions.push('a.acknowledged = false');
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Get total count
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total
       FROM alerts a
       JOIN patients p ON a.patient_id = p.patient_id
       ${whereClause}`,
      queryParams
    );
    const total = countResult[0].total;

    // Get alerts
    const [alerts] = await db.query(
      `SELECT 
        a.alert_id,
        p.patient_identifier as patient_id,
        CONCAT(p.first_name, ' ', p.last_name) as patient_name,
        s.sensor_identifier as sensor_id,
        a.alert_type,
        a.severity,
        a.message,
        a.reading_value,
        a.threshold_value,
        a.acknowledged,
        a.acknowledged_by,
        a.acknowledged_at,
        a.triggered_at as timestamp
       FROM alerts a
       JOIN patients p ON a.patient_id = p.patient_id
       LEFT JOIN sensors s ON a.sensor_id = s.sensor_id
       ${whereClause}
       ORDER BY a.triggered_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit), offset]
    );

    logger.info(`Retrieved ${alerts.length} alerts (acknowledged: ${acknowledged})`);

    res.status(200).json({
      success: true,
      data: {
        items: alerts.map(alert => ({
          alert_id: alert.alert_id,
          patient_id: alert.patient_id,
          patient_name: alert.patient_name,
          sensor_id: alert.sensor_id,
          alert_type: alert.alert_type,
          severity: alert.severity,
          message: alert.message,
          reading_value: alert.reading_value ? parseFloat(alert.reading_value) : null,
          threshold_value: alert.threshold_value ? parseFloat(alert.threshold_value) : null,
          acknowledged: Boolean(alert.acknowledged),
          acknowledged_by: alert.acknowledged_by,
          acknowledged_at: alert.acknowledged_at,
          timestamp: alert.timestamp,
          triggered_at: alert.timestamp  // Include both for compatibility
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while retrieving alerts'
      }
    });
  }
};

/**
 * Acknowledge an alert
 * PATCH /api/v1/alerts/:alert_id/acknowledge
 */
const acknowledgeAlert = async (req, res) => {
  try {
    const { alert_id } = req.params;
    const { acknowledged } = req.body;

    if (acknowledged !== true) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'acknowledged must be true'
        }
      });
    }

    // Check if alert exists and get patient info
    const [alerts] = await db.query(
      `SELECT a.alert_id, p.patient_identifier as patient_id
       FROM alerts a
       JOIN patients p ON a.patient_id = p.patient_id
       WHERE a.alert_id = ?`,
      [alert_id]
    );

    if (alerts.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_NOT_FOUND',
          message: 'Alert not found'
        }
      });
    }

    const patientId = alerts[0].patient_id;

    // Update alert
    await db.query(
      `UPDATE alerts 
       SET acknowledged = true, acknowledged_by = ?, acknowledged_at = CURRENT_TIMESTAMP
       WHERE alert_id = ?`,
      [req.user.user_id, alert_id]
    );

    // Get updated alert
    const [updatedAlerts] = await db.query(
      `SELECT alert_id, acknowledged, acknowledged_by, acknowledged_at
       FROM alerts
       WHERE alert_id = ?`,
      [alert_id]
    );

    logger.info(`Alert ${alert_id} acknowledged by user ${req.user.employee_id} for patient ${patientId}`);

    // Broadcast alert acknowledgment to SSE clients (includes patient_id for frontend state management)
    broadcastAlertAcknowledged({
      alert_id: parseInt(alert_id),
      patient_id: patientId,
      acknowledged_by: req.user.employee_id,
      acknowledged_at: updatedAlerts[0].acknowledged_at
    });

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (user_id, action_type, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user.user_id, 'acknowledge_alert', 'alerts', alert_id, JSON.stringify({
        alert_id,
        acknowledged_by: req.user.employee_id
      })]
    );

    res.status(200).json({
      success: true,
      data: {
        alert_id: parseInt(alert_id),
        acknowledged: true,
        acknowledged_by: req.user.user_id,
        acknowledged_at: updatedAlerts[0].acknowledged_at
      },
      message: 'Alert acknowledged'
    });

  } catch (error) {
    logger.error('Acknowledge alert error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while acknowledging alert'
      }
    });
  }
};

/**
 * Get alert thresholds for a patient
 * GET /api/v1/patients/:patient_id/thresholds
 */
const getThresholds = async (req, res) => {
  try {
    const { patient_id } = req.params;

    // Check if patient exists
    const [patients] = await db.query(
      'SELECT patient_id FROM patients WHERE patient_identifier = ?',
      [patient_id]
    );

    if (patients.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PATIENT_NOT_FOUND',
          message: 'Patient not found'
        }
      });
    }

    const db_patient_id = patients[0].patient_id;

    // Get thresholds
    const [thresholds] = await db.query(
      `SELECT threshold_id, metric_type, lower_limit, upper_limit
       FROM alert_thresholds
       WHERE patient_id = ?`,
      [db_patient_id]
    );

    // Format thresholds as object
    const thresholdsObj = {};
    thresholds.forEach(t => {
      thresholdsObj[t.metric_type] = {
        threshold_id: t.threshold_id,
        lower_limit: parseFloat(t.lower_limit),
        upper_limit: parseFloat(t.upper_limit)
      };
    });

    res.status(200).json({
      success: true,
      data: {
        patient_id,
        thresholds: thresholdsObj
      }
    });

  } catch (error) {
    logger.error('Get thresholds error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while retrieving thresholds'
      }
    });
  }
};

/**
 * Update alert thresholds for a patient
 * PUT /api/v1/patients/:patient_id/thresholds
 */
const updateThresholds = async (req, res) => {
  try {
    const { patient_id } = req.params;
    const thresholds = req.body;

    // Validate that we have threshold data
    if (!thresholds || Object.keys(thresholds).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Threshold data is required'
        }
      });
    }

    // Check if patient exists
    const [patients] = await db.query(
      'SELECT patient_id FROM patients WHERE patient_identifier = ?',
      [patient_id]
    );

    if (patients.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PATIENT_NOT_FOUND',
          message: 'Patient not found'
        }
      });
    }

    const db_patient_id = patients[0].patient_id;

    // Valid metric types
    const validMetrics = ['heart_rate', 'blood_oxygen', 'temperature'];
    const updatedThresholds = {};

    // Update each threshold
    for (const [metric_type, values] of Object.entries(thresholds)) {
      if (!validMetrics.includes(metric_type)) {
        continue; // Skip invalid metric types
      }

      if (!values.lower_limit || !values.upper_limit) {
        continue; // Skip if missing required values
      }

      // Update or insert threshold
      await db.query(
        `INSERT INTO alert_thresholds (patient_id, metric_type, lower_limit, upper_limit, created_by)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         lower_limit = VALUES(lower_limit),
         upper_limit = VALUES(upper_limit),
         updated_at = CURRENT_TIMESTAMP`,
        [db_patient_id, metric_type, values.lower_limit, values.upper_limit, req.user.user_id]
      );

      // Get updated threshold
      const [updated] = await db.query(
        `SELECT threshold_id, lower_limit, upper_limit, updated_at
         FROM alert_thresholds
         WHERE patient_id = ? AND metric_type = ?`,
        [db_patient_id, metric_type]
      );

      if (updated.length > 0) {
        updatedThresholds[metric_type] = {
          threshold_id: updated[0].threshold_id,
          lower_limit: parseFloat(updated[0].lower_limit),
          upper_limit: parseFloat(updated[0].upper_limit),
          updated_at: updated[0].updated_at
        };
      }
    }

    logger.info(`Thresholds updated for patient ${patient_id} by ${req.user.employee_id}`);

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (user_id, action_type, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user.user_id, 'update_threshold', 'alert_thresholds', patient_id, JSON.stringify({
        patient_id,
        thresholds: updatedThresholds,
        updated_by: req.user.employee_id
      })]
    );

    res.status(200).json({
      success: true,
      data: {
        patient_id,
        thresholds: updatedThresholds
      },
      message: 'Thresholds updated successfully'
    });

  } catch (error) {
    logger.error('Update thresholds error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while updating thresholds'
      }
    });
  }
};

module.exports = {
  getAlerts,
  acknowledgeAlert,
  getThresholds,
  updateThresholds
};
