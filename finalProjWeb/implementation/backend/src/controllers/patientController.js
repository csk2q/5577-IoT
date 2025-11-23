const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Patient Management Controller
 * Handles CRUD operations for patients
 * Nurse, Admin, and Intake roles have access
 */

/**
 * Get all patients with optional filters
 * GET /api/v1/patients
 */
const getPatients = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 100, 
      status = 'active',
      sort = 'room_number'
    } = req.query;

    const offset = (page - 1) * limit;

    // Validate sort parameter
    const validSorts = ['room_number', 'name', 'patient_id'];
    const sortColumn = validSorts.includes(sort) ? sort : 'room_number';
    
    // Map sort to actual columns
    const sortMap = {
      'room_number': 'p.room_number',
      'name': 'p.first_name',
      'patient_id': 'p.patient_identifier'
    };

    // Build query
    const whereClause = status ? 'WHERE p.status = ?' : '';
    const queryParams = status ? [status] : [];

    // Get total count
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total 
       FROM patients p 
       ${whereClause}`,
      queryParams
    );
    const total = countResult[0].total;

    // Get patients with sensor info and latest readings
    const [patients] = await db.query(
      `SELECT 
        p.patient_id,
        p.patient_identifier as patient_id,
        CONCAT(p.first_name, ' ', p.last_name) as name,
        p.room_number,
        s.sensor_identifier as sensor_id,
        p.status,
        p.created_at,
        sr.heart_rate,
        sr.blood_oxygen_level,
        sr.temperature,
        sr.timestamp as last_reading_time
       FROM patients p
       LEFT JOIN sensors s ON s.patient_id = p.patient_id AND s.status = 'active'
       LEFT JOIN (
         SELECT 
           sr1.sensor_id,
           sr1.heart_rate,
           sr1.blood_oxygen_level,
           sr1.temperature,
           sr1.timestamp
         FROM sensor_readings sr1
         INNER JOIN (
           SELECT sensor_id, MAX(timestamp) as max_timestamp
           FROM sensor_readings
           GROUP BY sensor_id
         ) sr2 ON sr1.sensor_id = sr2.sensor_id AND sr1.timestamp = sr2.max_timestamp
       ) sr ON sr.sensor_id = s.sensor_id
       ${whereClause}
       ORDER BY ${sortMap[sortColumn]} ASC
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit), offset]
    );

    logger.info(`Retrieved ${patients.length} patients (status: ${status}, sort: ${sort})`);

    res.status(200).json({
      success: true,
      data: {
        items: patients.map(p => ({
          patient_id: p.patient_id,
          name: p.name,
          room_number: p.room_number,
          sensor_id: p.sensor_id,
          status: p.status,
          created_at: p.created_at,
          // Include latest sensor readings if available
          latest_reading: p.heart_rate || p.blood_oxygen_level || p.temperature ? {
            heart_rate: p.heart_rate,
            oxygen_level: p.blood_oxygen_level,
            temperature: p.temperature,
            timestamp: p.last_reading_time
          } : null
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
    logger.error('Get patients error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while retrieving patients'
      }
    });
  }
};

/**
 * Get detailed information for a specific patient
 * GET /api/v1/patients/:patient_id
 */
const getPatient = async (req, res) => {
  try {
    const { patient_id } = req.params;

    // Get patient with sensor info
    const [patients] = await db.query(
      `SELECT 
        p.patient_id,
        p.patient_identifier,
        CONCAT(p.first_name, ' ', p.last_name) as name,
        p.room_number,
        s.sensor_identifier as sensor_id,
        p.status,
        p.created_at,
        p.updated_at
       FROM patients p
       LEFT JOIN sensors s ON s.patient_id = p.patient_id AND s.status = 'active'
       WHERE p.patient_identifier = ?`,
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

    const patient = patients[0];

    // Get alert thresholds
    const [thresholds] = await db.query(
      `SELECT metric_type, lower_limit, upper_limit
       FROM alert_thresholds
       WHERE patient_id = ?`,
      [patient.patient_id]
    );

    // Format thresholds
    const alert_thresholds = {};
    thresholds.forEach(t => {
      alert_thresholds[t.metric_type] = {
        lower_limit: parseFloat(t.lower_limit),
        upper_limit: parseFloat(t.upper_limit)
      };
    });

    // Get latest reading if sensor exists
    let latest_reading = null;
    if (patient.sensor_id) {
      const [readings] = await db.query(
        `SELECT blood_oxygen_level, heart_rate, timestamp
         FROM sensor_readings
         WHERE sensor_id = (SELECT sensor_id FROM sensors WHERE sensor_identifier = ?)
         ORDER BY timestamp DESC
         LIMIT 1`,
        [patient.sensor_id]
      );

      if (readings.length > 0) {
        latest_reading = {
          oxygen_level: parseFloat(readings[0].blood_oxygen_level),
          heart_rate: readings[0].heart_rate,
          timestamp: readings[0].timestamp
        };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        patient_id: patient.patient_identifier,
        name: patient.name,
        room_number: patient.room_number,
        sensor_id: patient.sensor_id,
        status: patient.status,
        created_at: patient.created_at,
        updated_at: patient.updated_at,
        alert_thresholds,
        latest_reading
      }
    });

  } catch (error) {
    logger.error('Get patient error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while retrieving patient'
      }
    });
  }
};

/**
 * Add a new patient (Intake role required)
 * POST /api/v1/patients
 */
const createPatient = async (req, res) => {
  try {
    const { patient_id, name, room_number, sensor_id } = req.body;

    // Validate required fields
    if (!patient_id || !name || !room_number) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Patient ID, name, and room number are required'
        }
      });
    }

    // Parse name into first and last
    const nameParts = name.trim().split(' ');
    const first_name = nameParts[0];
    const last_name = nameParts.slice(1).join(' ') || nameParts[0];

    // Check if patient_id already exists
    const [existingPatients] = await db.query(
      'SELECT patient_id FROM patients WHERE patient_identifier = ?',
      [patient_id]
    );

    if (existingPatients.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'PATIENT_ALREADY_EXISTS',
          message: 'Patient ID already exists'
        }
      });
    }

    // If sensor_id provided, check if it exists and is not already assigned
    if (sensor_id) {
      const [sensors] = await db.query(
        'SELECT sensor_id, patient_id FROM sensors WHERE sensor_identifier = ?',
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

      if (sensors[0].patient_id !== null) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'SENSOR_ALREADY_ASSIGNED',
            message: 'Sensor already assigned to another patient'
          }
        });
      }
    }

    // Insert new patient
    const [result] = await db.query(
      `INSERT INTO patients (patient_identifier, first_name, last_name, room_number, status) 
       VALUES (?, ?, ?, ?, 'active')`,
      [patient_id, first_name, last_name, room_number]
    );

    const new_patient_id = result.insertId;

    // Assign sensor if provided
    if (sensor_id) {
      await db.query(
        'UPDATE sensors SET patient_id = ?, status = "active", updated_at = CURRENT_TIMESTAMP WHERE sensor_identifier = ?',
        [new_patient_id, sensor_id]
      );
    }

    // Fetch created patient
    const [newPatients] = await db.query(
      `SELECT 
        p.patient_identifier,
        CONCAT(p.first_name, ' ', p.last_name) as name,
        p.room_number,
        s.sensor_identifier as sensor_id,
        p.status,
        p.created_at
       FROM patients p
       LEFT JOIN sensors s ON s.patient_id = p.patient_id
       WHERE p.patient_id = ?`,
      [new_patient_id]
    );

    logger.info(`Patient created: ${patient_id} in room ${room_number} by ${req.user.employee_id}`);

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (user_id, action_type, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user.user_id, 'create_patient', 'patients', patient_id, JSON.stringify({ 
        patient_id,
        room_number,
        sensor_id,
        created_by: req.user.employee_id
      })]
    );

    const patient = newPatients[0];

    res.status(201).json({
      success: true,
      data: {
        patient_id: patient.patient_identifier,
        name: patient.name,
        room_number: patient.room_number,
        sensor_id: patient.sensor_id,
        status: patient.status,
        created_at: patient.created_at
      },
      message: 'Patient added successfully'
    });

  } catch (error) {
    logger.error('Create patient error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while creating patient'
      }
    });
  }
};

/**
 * Update patient information
 * PATCH /api/v1/patients/:patient_id
 */
const updatePatient = async (req, res) => {
  try {
    const { patient_id } = req.params;
    const { room_number } = req.body;

    if (!room_number) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Room number is required'
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

    // Update patient
    await db.query(
      'UPDATE patients SET room_number = ?, updated_at = CURRENT_TIMESTAMP WHERE patient_identifier = ?',
      [room_number, patient_id]
    );

    logger.info(`Patient updated: ${patient_id} moved to room ${room_number} by ${req.user.employee_id}`);

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (user_id, action_type, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user.user_id, 'update_patient', 'patients', patient_id, JSON.stringify({ 
        patient_id,
        room_number,
        updated_by: req.user.employee_id
      })]
    );

    res.status(200).json({
      success: true,
      data: {
        patient_id,
        room_number,
        updated_at: new Date()
      },
      message: 'Patient updated successfully'
    });

  } catch (error) {
    logger.error('Update patient error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while updating patient'
      }
    });
  }
};

/**
 * Discharge a patient
 * PATCH /api/v1/patients/:patient_id/status
 */
const updatePatientStatus = async (req, res) => {
  try {
    const { patient_id } = req.params;
    const { status } = req.body;

    if (status !== 'discharged') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Status must be "discharged"'
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

    // Update patient status
    await db.query(
      'UPDATE patients SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE patient_identifier = ?',
      [status, patient_id]
    );

    // Unassign sensor
    await db.query(
      'UPDATE sensors SET patient_id = NULL, status = "inactive", updated_at = CURRENT_TIMESTAMP WHERE patient_id = ?',
      [patients[0].patient_id]
    );

    logger.info(`Patient discharged: ${patient_id} by ${req.user.employee_id}`);

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (user_id, action_type, resource_type, resource_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user.user_id, 'update_patient', 'patients', patient_id, JSON.stringify({ 
        patient_id,
        status: 'discharged',
        updated_by: req.user.employee_id
      })]
    );

    res.status(200).json({
      success: true,
      data: {
        patient_id,
        status,
        updated_at: new Date()
      },
      message: 'Patient discharged'
    });

  } catch (error) {
    logger.error('Update patient status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while updating patient status'
      }
    });
  }
};

module.exports = {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  updatePatientStatus
};
