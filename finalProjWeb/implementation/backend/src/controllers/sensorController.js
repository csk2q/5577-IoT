const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Sensor Data Controller
 * Handles sensor data ingestion and retrieval
 */

/**
 * Ingest sensor reading from ESP32 device
 * POST /api/v1/sensors/data
 */
const ingestSensorData = async (req, res) => {
  try {
    const { sensor_id, oxygen_level, heart_rate, temperature, timestamp } = req.body;

    // Validate required fields
    if (!sensor_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Sensor ID is required'
        }
      });
    }

    // Validate sensor data ranges
    if (heart_rate !== undefined && (heart_rate < 0 || heart_rate > 300)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SENSOR_DATA',
          message: 'Heart rate must be between 0 and 300 bpm'
        }
      });
    }

    if (oxygen_level !== undefined && (oxygen_level < 0 || oxygen_level > 100)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SENSOR_DATA',
          message: 'Oxygen level must be between 0 and 100%'
        }
      });
    }

    if (temperature !== undefined && (temperature < 30 || temperature > 45)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SENSOR_DATA',
          message: 'Temperature must be between 30 and 45°C'
        }
      });
    }

    // Check if sensor exists and get patient info
    const [sensors] = await db.query(
      `SELECT s.sensor_id, s.patient_id, s.status, p.patient_identifier
       FROM sensors s
       LEFT JOIN patients p ON s.patient_id = p.patient_id
       WHERE s.sensor_identifier = ?`,
      [sensor_id]
    );

    if (sensors.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SENSOR_NOT_FOUND',
          message: 'Sensor not found'
        }
      });
    }

    const sensor = sensors[0];

    // Insert sensor reading
    const readingTimestamp = timestamp ? new Date(timestamp) : new Date();
    const [result] = await db.query(
      `INSERT INTO sensor_readings (sensor_id, patient_id, heart_rate, blood_oxygen_level, temperature, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sensor.sensor_id,
        sensor.patient_id,
        heart_rate || null,
        oxygen_level || null,
        temperature || null,
        readingTimestamp
      ]
    );

    const reading_id = result.insertId;

    // Check alert thresholds if patient is assigned
    if (sensor.patient_id) {
      await checkAlertThresholds(
        sensor.patient_id,
        sensor.patient_identifier,
        sensor.sensor_id,
        sensor_id,
        heart_rate,
        oxygen_level,
        temperature
      );
    }

    logger.info(`Sensor reading ingested: ${sensor_id} (reading_id: ${reading_id})`);

    res.status(201).json({
      success: true,
      data: {
        reading_id,
        sensor_id,
        stored_at: new Date()
      }
    });

  } catch (error) {
    logger.error('Ingest sensor data error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while ingesting sensor data'
      }
    });
  }
};

/**
 * Helper function to check alert thresholds
 */
async function checkAlertThresholds(patient_id, patient_identifier, sensor_id, sensor_identifier, heart_rate, oxygen_level, temperature) {
  try {
    // Get alert thresholds for this patient
    const [thresholds] = await db.query(
      `SELECT metric_type, lower_limit, upper_limit
       FROM alert_thresholds
       WHERE patient_id = ?`,
      [patient_id]
    );

    const alerts = [];

    for (const threshold of thresholds) {
      let value = null;
      let metricName = null;

      if (threshold.metric_type === 'heart_rate' && heart_rate !== undefined) {
        value = heart_rate;
        metricName = 'heart_rate';
      } else if (threshold.metric_type === 'blood_oxygen' && oxygen_level !== undefined) {
        value = oxygen_level;
        metricName = 'blood_oxygen';
      } else if (threshold.metric_type === 'temperature' && temperature !== undefined) {
        value = temperature;
        metricName = 'temperature';
      }

      if (value !== null) {
        let thresholdExceeded = null;

        if (value < threshold.lower_limit) {
          thresholdExceeded = 'lower';
        } else if (value > threshold.upper_limit) {
          thresholdExceeded = 'upper';
        }

        if (thresholdExceeded) {
          // Determine alert type and severity based on metric and direction
          let alert_type, severity, message;
          
          if (metricName === 'heart_rate') {
            alert_type = thresholdExceeded === 'lower' ? 'heart_rate_low' : 'heart_rate_high';
            severity = 'warning';
            message = `Heart rate ${thresholdExceeded === 'lower' ? 'below' : 'above'} threshold: ${value} bpm`;
          } else if (metricName === 'blood_oxygen') {
            alert_type = thresholdExceeded === 'lower' ? 'oxygen_low' : 'oxygen_high';
            severity = 'critical';
            message = `Blood oxygen ${thresholdExceeded === 'lower' ? 'below' : 'above'} threshold: ${value}%`;
          } else if (metricName === 'temperature') {
            alert_type = thresholdExceeded === 'lower' ? 'temperature_low' : 'temperature_high';
            severity = 'warning';
            message = `Temperature ${thresholdExceeded === 'lower' ? 'below' : 'above'} threshold: ${value}°C`;
          }
          
          // Create alert
          await db.query(
            `INSERT INTO alerts (patient_id, sensor_id, alert_type, severity, message, reading_value, threshold_value, acknowledged, triggered_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, false, NOW())`,
            [patient_id, sensor_id, alert_type, severity, message, value, 
             thresholdExceeded === 'lower' ? threshold.lower_limit : threshold.upper_limit]
          );

          alerts.push({
            patient_id: patient_identifier,
            metric: metricName,
            value,
            threshold_exceeded: thresholdExceeded
          });

          logger.warn(`Alert triggered: Patient ${patient_identifier}, ${metricName}=${value} (${thresholdExceeded} threshold)`);
        }
      }
    }

    return alerts;
  } catch (error) {
    logger.error('Check alert thresholds error:', error);
    // Don't throw - we don't want alert checking to fail the ingestion
  }
}

/**
 * Receive alert from ESP32 device (button press or LED trigger)
 * POST /api/v1/sensors/alert
 */
const receiveAlert = async (req, res) => {
  try {
    const { sensor_id, alert_type, timestamp } = req.body;

    // Validate required fields
    if (!sensor_id || !alert_type) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Sensor ID and alert type are required'
        }
      });
    }

    // Validate alert_type
    if (!['button_pressed', 'sensor_offline'].includes(alert_type)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Alert type must be either "button_pressed" or "sensor_offline"'
        }
      });
    }

    // Check if sensor exists and get patient info
    const [sensors] = await db.query(
      `SELECT s.sensor_id, s.patient_id, p.patient_identifier
       FROM sensors s
       LEFT JOIN patients p ON s.patient_id = p.patient_id
       WHERE s.sensor_identifier = ?`,
      [sensor_id]
    );

    if (sensors.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SENSOR_NOT_FOUND',
          message: 'Sensor not found'
        }
      });
    }

    const sensor = sensors[0];

    // Insert alert
    const alertTimestamp = timestamp ? new Date(timestamp) : new Date();
    const severity = alert_type === 'button_pressed' ? 'critical' : 'warning';
    const message = alert_type === 'button_pressed' 
      ? 'Patient call button pressed' 
      : 'Sensor offline';
    
    const [result] = await db.query(
      `INSERT INTO alerts (patient_id, sensor_id, alert_type, severity, message, acknowledged, triggered_at)
       VALUES (?, ?, ?, ?, ?, false, ?)`,
      [sensor.patient_id, sensor.sensor_id, alert_type, severity, message, alertTimestamp]
    );

    const alert_id = result.insertId;

    logger.warn(`Alert received: ${sensor_id}, type: ${alert_type}, patient: ${sensor.patient_identifier}`);

    res.status(201).json({
      success: true,
      data: {
        alert_id,
        patient_id: sensor.patient_identifier,
        alert_type,
        timestamp: alertTimestamp
      }
    });

  } catch (error) {
    logger.error('Receive alert error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while processing alert'
      }
    });
  }
};

/**
 * Get recent readings for a specific sensor
 * GET /api/v1/sensors/:sensor_id/readings
 */
const getSensorReadings = async (req, res) => {
  try {
    const { sensor_id } = req.params;
    const { limit = 20, since } = req.query;

    // Validate limit
    const maxLimit = 100;
    const readingLimit = Math.min(parseInt(limit) || 20, maxLimit);

    // Check if sensor exists
    const [sensors] = await db.query(
      'SELECT sensor_id FROM sensors WHERE sensor_identifier = ?',
      [sensor_id]
    );

    if (sensors.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SENSOR_NOT_FOUND',
          message: 'Sensor not found'
        }
      });
    }

    const db_sensor_id = sensors[0].sensor_id;

    // Build query with optional time filter
    let query = `
      SELECT reading_id, heart_rate, blood_oxygen_level as oxygen_level, temperature, timestamp
      FROM sensor_readings
      WHERE sensor_id = ?
    `;
    const queryParams = [db_sensor_id];

    if (since) {
      query += ' AND timestamp > ?';
      queryParams.push(new Date(since));
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    queryParams.push(readingLimit);

    const [readings] = await db.query(query, queryParams);

    logger.info(`Retrieved ${readings.length} readings for sensor ${sensor_id}`);

    res.status(200).json({
      success: true,
      data: {
        sensor_id,
        readings: readings.map(r => ({
          reading_id: r.reading_id,
          oxygen_level: r.oxygen_level ? parseFloat(r.oxygen_level) : null,
          heart_rate: r.heart_rate,
          temperature: r.temperature ? parseFloat(r.temperature) : null,
          timestamp: r.timestamp
        }))
      }
    });

  } catch (error) {
    logger.error('Get sensor readings error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while retrieving sensor readings'
      }
    });
  }
};

module.exports = {
  ingestSensorData,
  receiveAlert,
  getSensorReadings
};
