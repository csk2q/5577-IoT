-- IoT Nursing Station Dashboard - Seed Data
-- Initial data for development and testing
-- Created: November 22, 2025

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ============================================================================
-- USERS - Create default users for each role
-- Default password for all users: "password123" (bcrypt hashed)
-- ============================================================================

-- Note: All users have the password "password123" for testing purposes
-- In production, use bcrypt with salt rounds 10-12 and require password change on first login
-- Bcrypt hash generated with 10 salt rounds

INSERT INTO users (employee_id, password_hash, first_name, last_name, email, role, status) VALUES
-- Admin user
('100001', '$2b$10$/6d4S8R.r/0saS5DsRWOWO7a9PigRCGrNe/ise1FwMi0Wt8VWYS3K', 'Sarah', 'Johnson', 'sarah.johnson@hospital.com', 'admin', 'active'),

-- Nurse users
('200001', '$2b$10$/6d4S8R.r/0saS5DsRWOWO7a9PigRCGrNe/ise1FwMi0Wt8VWYS3K', 'Michael', 'Chen', 'michael.chen@hospital.com', 'nurse', 'active'),
('200002', '$2b$10$/6d4S8R.r/0saS5DsRWOWO7a9PigRCGrNe/ise1FwMi0Wt8VWYS3K', 'Jennifer', 'Martinez', 'jennifer.martinez@hospital.com', 'nurse', 'active'),
('200003', '$2b$10$/6d4S8R.r/0saS5DsRWOWO7a9PigRCGrNe/ise1FwMi0Wt8VWYS3K', 'David', 'Williams', 'david.williams@hospital.com', 'nurse', 'active'),

-- Intake specialist
('300001', '$2b$10$/6d4S8R.r/0saS5DsRWOWO7a9PigRCGrNe/ise1FwMi0Wt8VWYS3K', 'Emily', 'Davis', 'emily.davis@hospital.com', 'intake', 'active');

-- ============================================================================
-- PATIENTS - Create sample patients for testing
-- ============================================================================

INSERT INTO patients (patient_identifier, first_name, last_name, date_of_birth, room_number, status) VALUES
('P-2025-001', 'Robert', 'Anderson', '1955-03-15', '101A', 'active'),
('P-2025-002', 'Mary', 'Thompson', '1962-07-22', '101B', 'active'),
('P-2025-003', 'James', 'Wilson', '1948-11-30', '102A', 'active'),
('P-2025-004', 'Patricia', 'Moore', '1970-05-18', '102B', 'active'),
('P-2025-005', 'John', 'Taylor', '1958-09-25', '103A', 'active'),
('P-2025-006', 'Linda', 'Jackson', '1965-12-08', '103B', 'active'),
('P-2025-007', 'William', 'White', '1952-04-14', '104A', 'active'),
('P-2025-008', 'Barbara', 'Harris', '1968-08-27', '104B', 'active'),
('P-2025-009', 'Richard', 'Martin', '1960-02-11', '105A', 'active'),
('P-2025-010', 'Susan', 'Thompson', '1973-06-19', '105B', 'active');

-- ============================================================================
-- SENSORS - Assign sensors to patients
-- ============================================================================

INSERT INTO sensors (sensor_identifier, patient_id, sensor_type, status, firmware_version) VALUES
('ESP32-VS-001', 1, 'vital_signs', 'active', '1.2.3'),
('ESP32-VS-002', 2, 'vital_signs', 'active', '1.2.3'),
('ESP32-VS-003', 3, 'vital_signs', 'active', '1.2.3'),
('ESP32-VS-004', 4, 'vital_signs', 'active', '1.2.3'),
('ESP32-VS-005', 5, 'vital_signs', 'active', '1.2.3'),
('ESP32-VS-006', 6, 'vital_signs', 'active', '1.2.3'),
('ESP32-VS-007', 7, 'vital_signs', 'active', '1.2.3'),
('ESP32-VS-008', 8, 'vital_signs', 'active', '1.2.3'),
('ESP32-VS-009', 9, 'vital_signs', 'active', '1.2.3'),
('ESP32-VS-010', 10, 'vital_signs', 'active', '1.2.3');

-- ============================================================================
-- ALERT THRESHOLDS - Set default thresholds for all patients
-- ============================================================================

-- Heart rate thresholds (normal: 60-100 bpm)
INSERT INTO alert_thresholds (patient_id, metric_type, lower_limit, upper_limit, severity, enabled, created_by) VALUES
(1, 'heart_rate', 60.00, 100.00, 'warning', TRUE, 1),
(2, 'heart_rate', 60.00, 100.00, 'warning', TRUE, 1),
(3, 'heart_rate', 60.00, 100.00, 'warning', TRUE, 1),
(4, 'heart_rate', 60.00, 100.00, 'warning', TRUE, 1),
(5, 'heart_rate', 60.00, 100.00, 'warning', TRUE, 1),
(6, 'heart_rate', 60.00, 100.00, 'warning', TRUE, 1),
(7, 'heart_rate', 60.00, 100.00, 'warning', TRUE, 1),
(8, 'heart_rate', 60.00, 100.00, 'warning', TRUE, 1),
(9, 'heart_rate', 60.00, 100.00, 'warning', TRUE, 1),
(10, 'heart_rate', 60.00, 100.00, 'warning', TRUE, 1);

-- Blood oxygen thresholds (normal: 95-100%)
INSERT INTO alert_thresholds (patient_id, metric_type, lower_limit, upper_limit, severity, enabled, created_by) VALUES
(1, 'blood_oxygen', 90.00, 100.00, 'critical', TRUE, 1),
(2, 'blood_oxygen', 90.00, 100.00, 'critical', TRUE, 1),
(3, 'blood_oxygen', 90.00, 100.00, 'critical', TRUE, 1),
(4, 'blood_oxygen', 90.00, 100.00, 'critical', TRUE, 1),
(5, 'blood_oxygen', 90.00, 100.00, 'critical', TRUE, 1),
(6, 'blood_oxygen', 90.00, 100.00, 'critical', TRUE, 1),
(7, 'blood_oxygen', 90.00, 100.00, 'critical', TRUE, 1),
(8, 'blood_oxygen', 90.00, 100.00, 'critical', TRUE, 1),
(9, 'blood_oxygen', 90.00, 100.00, 'critical', TRUE, 1),
(10, 'blood_oxygen', 90.00, 100.00, 'critical', TRUE, 1);

-- Temperature thresholds (normal: 36.1-37.8°C / 97-100°F)
INSERT INTO alert_thresholds (patient_id, metric_type, lower_limit, upper_limit, severity, enabled, created_by) VALUES
(1, 'temperature', 36.1, 37.8, 'warning', TRUE, 1),
(2, 'temperature', 36.1, 37.8, 'warning', TRUE, 1),
(3, 'temperature', 36.1, 37.8, 'warning', TRUE, 1),
(4, 'temperature', 36.1, 37.8, 'warning', TRUE, 1),
(5, 'temperature', 36.1, 37.8, 'warning', TRUE, 1),
(6, 'temperature', 36.1, 37.8, 'warning', TRUE, 1),
(7, 'temperature', 36.1, 37.8, 'warning', TRUE, 1),
(8, 'temperature', 36.1, 37.8, 'warning', TRUE, 1),
(9, 'temperature', 36.1, 37.8, 'warning', TRUE, 1),
(10, 'temperature', 36.1, 37.8, 'warning', TRUE, 1);

-- ============================================================================
-- SAMPLE SENSOR READINGS - Add recent readings for testing dashboard
-- ============================================================================

-- Patient 1 - Normal vitals
INSERT INTO sensor_readings (sensor_id, patient_id, heart_rate, blood_oxygen_level, temperature, reading_quality) VALUES
(1, 1, 72, 98.5, 37.0, 'good'),
(1, 1, 74, 98.2, 37.1, 'good'),
(1, 1, 73, 98.4, 37.0, 'good'),
(1, 1, 71, 98.6, 36.9, 'good'),
(1, 1, 75, 98.3, 37.0, 'good');

-- Patient 2 - Normal vitals
INSERT INTO sensor_readings (sensor_id, patient_id, heart_rate, blood_oxygen_level, temperature, reading_quality) VALUES
(2, 2, 68, 97.8, 36.8, 'good'),
(2, 2, 70, 97.9, 36.9, 'good'),
(2, 2, 69, 98.0, 36.8, 'good'),
(2, 2, 71, 98.1, 36.9, 'good'),
(2, 2, 70, 97.9, 36.8, 'good');

-- Patient 3 - Slightly elevated heart rate
INSERT INTO sensor_readings (sensor_id, patient_id, heart_rate, blood_oxygen_level, temperature, reading_quality) VALUES
(3, 3, 88, 96.5, 37.2, 'good'),
(3, 3, 90, 96.8, 37.3, 'good'),
(3, 3, 89, 96.7, 37.2, 'good'),
(3, 3, 91, 96.9, 37.3, 'good'),
(3, 3, 87, 96.6, 37.2, 'good');

-- Patient 4 - Normal vitals
INSERT INTO sensor_readings (sensor_id, patient_id, heart_rate, blood_oxygen_level, temperature, reading_quality) VALUES
(4, 4, 76, 99.0, 36.7, 'good'),
(4, 4, 78, 99.1, 36.8, 'good'),
(4, 4, 77, 98.9, 36.7, 'good'),
(4, 4, 75, 99.0, 36.8, 'good'),
(4, 4, 79, 99.2, 36.7, 'good');

-- Patient 5 - Slightly low oxygen (warning zone)
INSERT INTO sensor_readings (sensor_id, patient_id, heart_rate, blood_oxygen_level, temperature, reading_quality) VALUES
(5, 5, 82, 92.5, 37.1, 'good'),
(5, 5, 84, 92.8, 37.2, 'good'),
(5, 5, 83, 92.6, 37.1, 'good'),
(5, 5, 81, 92.9, 37.1, 'good'),
(5, 5, 85, 92.7, 37.2, 'good');

-- Patient 6 - Normal vitals
INSERT INTO sensor_readings (sensor_id, patient_id, heart_rate, blood_oxygen_level, temperature, reading_quality) VALUES
(6, 6, 65, 98.7, 36.6, 'good'),
(6, 6, 67, 98.8, 36.7, 'good'),
(6, 6, 66, 98.6, 36.6, 'good'),
(6, 6, 68, 98.9, 36.7, 'good'),
(6, 6, 64, 98.7, 36.6, 'good');

-- Patient 7 - Normal vitals
INSERT INTO sensor_readings (sensor_id, patient_id, heart_rate, blood_oxygen_level, temperature, reading_quality) VALUES
(7, 7, 73, 97.5, 37.0, 'good'),
(7, 7, 75, 97.6, 37.1, 'good'),
(7, 7, 74, 97.4, 37.0, 'good'),
(7, 7, 72, 97.7, 37.0, 'good'),
(7, 7, 76, 97.5, 37.1, 'good');

-- Patient 8 - Normal vitals
INSERT INTO sensor_readings (sensor_id, patient_id, heart_rate, blood_oxygen_level, temperature, reading_quality) VALUES
(8, 8, 70, 98.3, 36.9, 'good'),
(8, 8, 72, 98.4, 37.0, 'good'),
(8, 8, 71, 98.2, 36.9, 'good'),
(8, 8, 69, 98.5, 36.9, 'good'),
(8, 8, 73, 98.3, 37.0, 'good');

-- Patient 9 - Slightly elevated temperature
INSERT INTO sensor_readings (sensor_id, patient_id, heart_rate, blood_oxygen_level, temperature, reading_quality) VALUES
(9, 9, 86, 97.2, 38.1, 'good'),
(9, 9, 88, 97.3, 38.2, 'good'),
(9, 9, 87, 97.1, 38.1, 'good'),
(9, 9, 85, 97.4, 38.0, 'good'),
(9, 9, 89, 97.2, 38.2, 'good');

-- Patient 10 - Normal vitals
INSERT INTO sensor_readings (sensor_id, patient_id, heart_rate, blood_oxygen_level, temperature, reading_quality) VALUES
(10, 10, 77, 98.0, 36.8, 'good'),
(10, 10, 79, 98.1, 36.9, 'good'),
(10, 10, 78, 97.9, 36.8, 'good'),
(10, 10, 76, 98.2, 36.8, 'good'),
(10, 10, 80, 98.0, 36.9, 'good');

-- ============================================================================
-- SAMPLE ALERTS - Create some alerts for testing
-- ============================================================================

-- Alert for Patient 5 (low oxygen)
INSERT INTO alerts (patient_id, sensor_id, alert_type, severity, message, reading_value, threshold_value, acknowledged, triggered_at) VALUES
(5, 5, 'oxygen_low', 'warning', 'Blood oxygen level below threshold', 92.5, 95.0, FALSE, DATE_SUB(NOW(), INTERVAL 2 HOUR));

-- Alert for Patient 9 (elevated temperature)
INSERT INTO alerts (patient_id, sensor_id, alert_type, severity, message, reading_value, threshold_value, acknowledged, triggered_at) VALUES
(9, 9, 'temperature_high', 'warning', 'Temperature above normal range', 38.2, 37.8, FALSE, DATE_SUB(NOW(), INTERVAL 1 HOUR));

-- Acknowledged alert for Patient 3
INSERT INTO alerts (patient_id, sensor_id, alert_type, severity, message, reading_value, threshold_value, acknowledged, acknowledged_by, acknowledged_at, triggered_at) VALUES
(3, 3, 'heart_rate_high', 'warning', 'Heart rate elevated above threshold', 91, 100, TRUE, 2, DATE_SUB(NOW(), INTERVAL 30 MINUTE), DATE_SUB(NOW(), INTERVAL 3 HOUR));

-- ============================================================================
-- AUDIT LOG ENTRIES - Sample audit trail
-- ============================================================================

INSERT INTO audit_logs (user_id, action_type, resource_type, resource_id, ip_address, details) VALUES
(1, 'login', NULL, NULL, '192.168.1.100', '{"user_agent": "Mozilla/5.0"}'),
(2, 'login', NULL, NULL, '192.168.1.101', '{"user_agent": "Mozilla/5.0"}'),
(2, 'view_patient', 'patient', '5', '192.168.1.101', '{"action": "viewed patient details"}'),
(2, 'acknowledge_alert', 'alert', '3', '192.168.1.101', '{"alert_type": "heart_rate_high"}'),
(5, 'create_patient', 'patient', '10', '192.168.1.105', '{"action": "created new patient record"}');

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

SELECT '✓ Seed data loaded successfully!' AS status,
       (SELECT COUNT(*) FROM users) AS user_count,
       (SELECT COUNT(*) FROM patients) AS patient_count,
       (SELECT COUNT(*) FROM sensors) AS sensor_count,
       (SELECT COUNT(*) FROM sensor_readings) AS reading_count,
       (SELECT COUNT(*) FROM alert_thresholds) AS threshold_count,
       (SELECT COUNT(*) FROM alerts) AS alert_count;
