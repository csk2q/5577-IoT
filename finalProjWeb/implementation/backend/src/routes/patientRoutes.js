const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { getThresholds, updateThresholds } = require('./alertRoutes');
const { authenticateJWT, authorize } = require('../middleware/auth');

/**
 * Patient Management Routes
 * Base path: /api/v1/patients
 * Nurse, Admin, and Intake roles have access
 */

// GET /api/v1/patients - List all patients
router.get('/', authenticateJWT, authorize('nurse', 'admin', 'intake'), patientController.getPatients);

// GET /api/v1/patients/:patient_id - Get patient details
router.get('/:patient_id', authenticateJWT, authorize('nurse', 'admin', 'intake'), patientController.getPatient);

// POST /api/v1/patients - Add new patient (Intake role required)
router.post('/', authenticateJWT, authorize('intake', 'admin'), patientController.createPatient);

// PATCH /api/v1/patients/:patient_id - Update patient
router.patch('/:patient_id', authenticateJWT, authorize('nurse', 'admin', 'intake'), patientController.updatePatient);

// PATCH /api/v1/patients/:patient_id/status - Discharge patient
router.patch('/:patient_id/status', authenticateJWT, authorize('nurse', 'admin', 'intake'), patientController.updatePatientStatus);

// GET /api/v1/patients/:patient_id/thresholds - Get alert thresholds
router.get('/:patient_id/thresholds', authenticateJWT, authorize('nurse', 'admin'), getThresholds);

// PUT /api/v1/patients/:patient_id/thresholds - Update alert thresholds
router.put('/:patient_id/thresholds', authenticateJWT, authorize('nurse', 'admin'), updateThresholds);

module.exports = router;
