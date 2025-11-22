-- IoT Nursing Station Dashboard - Database Schema
-- MySQL 8.0+
-- Created: November 22, 2025

-- Create database schema for patient monitoring system
-- This script runs automatically when the database container starts

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ============================================================================
-- USERS TABLE
-- Stores authentication and role information for system users
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(6) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role ENUM('nurse', 'admin', 'intake') NOT NULL,
    status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_employee_id (employee_id),
    INDEX idx_role (role),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PATIENTS TABLE
-- Stores patient demographic and assignment information
-- ============================================================================
CREATE TABLE IF NOT EXISTS patients (
    patient_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_identifier VARCHAR(50) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    room_number VARCHAR(20) NOT NULL,
    admission_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    discharge_date TIMESTAMP NULL,
    status ENUM('active', 'discharged') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_patient_identifier (patient_identifier),
    INDEX idx_room_number (room_number),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SENSORS TABLE
-- Stores IoT sensor device information and assignments
-- ============================================================================
CREATE TABLE IF NOT EXISTS sensors (
    sensor_id INT AUTO_INCREMENT PRIMARY KEY,
    sensor_identifier VARCHAR(50) NOT NULL UNIQUE,
    patient_id INT NULL,
    sensor_type ENUM('vital_signs', 'alert_button') NOT NULL DEFAULT 'vital_signs',
    status ENUM('active', 'inactive', 'maintenance') NOT NULL DEFAULT 'active',
    last_reading_time TIMESTAMP NULL,
    firmware_version VARCHAR(20),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE SET NULL,
    INDEX idx_sensor_identifier (sensor_identifier),
    INDEX idx_patient_id (patient_id),
    INDEX idx_status (status),
    INDEX idx_last_reading_time (last_reading_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SENSOR_READINGS TABLE
-- Stores time-series vital signs data from sensors
-- Optimized for high-frequency writes and time-based queries
-- ============================================================================
CREATE TABLE IF NOT EXISTS sensor_readings (
    reading_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sensor_id INT NOT NULL,
    patient_id INT NOT NULL,
    timestamp TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    heart_rate INT NULL,
    blood_oxygen_level DECIMAL(5,2) NULL,
    temperature DECIMAL(4,1) NULL,
    reading_quality ENUM('good', 'fair', 'poor') NOT NULL DEFAULT 'good',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sensor_id) REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    INDEX idx_sensor_timestamp (sensor_id, timestamp DESC),
    INDEX idx_patient_timestamp (patient_id, timestamp DESC),
    INDEX idx_timestamp (timestamp DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ALERT_THRESHOLDS TABLE
-- Stores per-patient configurable alert thresholds for vital signs
-- ============================================================================
CREATE TABLE IF NOT EXISTS alert_thresholds (
    threshold_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    metric_type ENUM('heart_rate', 'blood_oxygen', 'temperature') NOT NULL,
    lower_limit DECIMAL(5,2) NOT NULL,
    upper_limit DECIMAL(5,2) NOT NULL,
    severity ENUM('warning', 'critical') NOT NULL DEFAULT 'warning',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    UNIQUE KEY unique_patient_metric (patient_id, metric_type),
    INDEX idx_patient_id (patient_id),
    INDEX idx_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ALERTS TABLE
-- Stores triggered alerts from threshold violations or manual button presses
-- ============================================================================
CREATE TABLE IF NOT EXISTS alerts (
    alert_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    sensor_id INT NOT NULL,
    alert_type ENUM('button_pressed', 'heart_rate_low', 'heart_rate_high', 
                    'oxygen_low', 'oxygen_high', 'temperature_low', 
                    'temperature_high', 'sensor_offline') NOT NULL,
    severity ENUM('info', 'warning', 'critical') NOT NULL,
    message TEXT NOT NULL,
    reading_value DECIMAL(5,2) NULL,
    threshold_value DECIMAL(5,2) NULL,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by INT NULL,
    acknowledged_at TIMESTAMP NULL,
    triggered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (sensor_id) REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    FOREIGN KEY (acknowledged_by) REFERENCES users(user_id),
    INDEX idx_patient_id (patient_id),
    INDEX idx_triggered_at (triggered_at DESC),
    INDEX idx_acknowledged (acknowledged),
    INDEX idx_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- AUDIT_LOGS TABLE
-- Stores audit trail for HIPAA compliance
-- Records all access and modifications to patient data
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action_type ENUM('login', 'logout', 'view_patient', 'update_patient', 
                     'create_patient', 'delete_patient', 'view_readings',
                     'update_threshold', 'acknowledge_alert', 'create_user',
                     'update_user', 'disable_user') NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(50),
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_action_type (action_type),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_resource (resource_type, resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- CREATE DEFAULT ALERT THRESHOLDS VIEW
-- Provides default threshold values for new patients
-- ============================================================================
CREATE OR REPLACE VIEW default_thresholds AS
SELECT 
    'heart_rate' AS metric_type,
    60.00 AS lower_limit,
    100.00 AS upper_limit,
    'warning' AS severity
UNION ALL
SELECT 
    'blood_oxygen' AS metric_type,
    90.00 AS lower_limit,
    100.00 AS upper_limit,
    'critical' AS severity
UNION ALL
SELECT 
    'temperature' AS metric_type,
    36.1 AS lower_limit,
    37.8 AS upper_limit,
    'warning' AS severity;

-- ============================================================================
-- STORED PROCEDURE: Get Latest Readings for All Active Patients
-- Used by dashboard to efficiently retrieve current patient status
-- ============================================================================
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS get_latest_readings_for_all_patients()
BEGIN
    SELECT 
        p.patient_id,
        p.patient_identifier,
        p.first_name,
        p.last_name,
        p.room_number,
        s.sensor_id,
        s.sensor_identifier,
        sr.reading_id,
        sr.timestamp,
        sr.heart_rate,
        sr.blood_oxygen_level,
        sr.temperature,
        sr.reading_quality
    FROM patients p
    INNER JOIN sensors s ON p.patient_id = s.patient_id
    LEFT JOIN sensor_readings sr ON sr.reading_id = (
        SELECT reading_id 
        FROM sensor_readings 
        WHERE sensor_id = s.sensor_id 
        ORDER BY timestamp DESC 
        LIMIT 1
    )
    WHERE p.status = 'active' 
      AND s.status = 'active'
    ORDER BY p.room_number;
END //

DELIMITER ;

-- ============================================================================
-- STORED PROCEDURE: Get Last N Readings for Patient
-- Retrieves time-series data for sparkline graphs
-- ============================================================================
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS get_last_n_readings(
    IN p_patient_id INT,
    IN p_limit INT
)
BEGIN
    SELECT 
        sr.reading_id,
        sr.timestamp,
        sr.heart_rate,
        sr.blood_oxygen_level,
        sr.temperature,
        sr.reading_quality
    FROM sensor_readings sr
    INNER JOIN sensors s ON sr.sensor_id = s.sensor_id
    WHERE sr.patient_id = p_patient_id
      AND s.status = 'active'
    ORDER BY sr.timestamp DESC
    LIMIT p_limit;
END //

DELIMITER ;

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- Additional composite indexes for common query patterns
-- ============================================================================

-- Fast lookup for active patients with recent readings
CREATE INDEX idx_active_patients_recent ON sensor_readings(patient_id, timestamp DESC) 
    WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR);

-- Fast alert queries for dashboard
CREATE INDEX idx_unacknowledged_alerts ON alerts(patient_id, acknowledged, triggered_at DESC);

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================
SELECT 'Database schema initialized successfully!' AS status;
