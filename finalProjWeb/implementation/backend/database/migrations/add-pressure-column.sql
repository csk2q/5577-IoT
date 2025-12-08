-- Add pressure_status column to sensor_readings table
-- This tracks whether the pressure sensor is on (1) or off (0)

ALTER TABLE sensor_readings 
ADD COLUMN pressure_status TINYINT(1) NULL COMMENT 'Pressure sensor status: 1=on (normal), 0=off (alert)' 
AFTER temperature;

-- Add index for pressure status queries
CREATE INDEX idx_pressure_status ON sensor_readings(pressure_status);
