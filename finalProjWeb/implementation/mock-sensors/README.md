# Mock Sensor Framework

Test automation framework that simulates ESP32 IoT sensors for the Nursing Station Dashboard.

## Overview

This mock framework simulates the behavior of ESP32 sensors that measure patient vital signs. It allows for comprehensive testing without requiring physical hardware.

## Features

- **Realistic Sensor Simulation**: Mimics actual ESP32 sensor behavior
- **Configurable Scenarios**: Normal, warning, critical, offline states
- **Multiple Sensors**: Simulate 1-100+ sensors simultaneously
- **CLI Control**: Command-line interface for easy operation
- **API Integration**: Sends data to backend API like real sensors

## Directory Structure

```
mock-sensors/
├── src/
│   ├── sensors/         # Sensor simulation classes
│   │   └── MockSensor.js
│   ├── scenarios/       # Predefined test scenarios
│   ├── config/          # Configuration files
│   ├── utils/          # Utility functions
│   ├── cli.js          # Command-line interface
│   └── index.js        # Main entry point
├── tests/              # Test files
├── config/             # Configuration files
│   └── sensors.json    # Sensor fleet configuration
└── package.json        # Dependencies
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure backend API endpoint:
```bash
# Edit .env or pass as environment variable
API_BASE_URL=http://localhost:3000/api/v1
```

3. Start mock sensors:
```bash
npm start
```

## Usage

### CLI Commands

Start a single sensor:
```bash
npm run cli -- start --sensor-id SENSOR_001 --interval 5000
```

Start multiple sensors:
```bash
npm run cli -- start-fleet --count 30
```

Trigger alert:
```bash
npm run cli -- alert --sensor-id SENSOR_001 --type button_pressed
```

Change sensor behavior:
```bash
npm run cli -- behavior --sensor-id SENSOR_001 --mode critical
```

Stop all sensors:
```bash
npm run cli -- stop-all
```

### Programmatic Usage

```javascript
const MockSensor = require('./src/sensors/MockSensor');

const sensor = new MockSensor({
  sensor_id: 'SENSOR_001',
  interval: 5000,
  behavior: 'normal'
});

sensor.start();

// Change behavior after 30 seconds
setTimeout(() => {
  sensor.setBehavior('critical');
}, 30000);

// Stop after 60 seconds
setTimeout(() => {
  sensor.stop();
}, 60000);
```

## Sensor Behaviors

### Normal
- Oxygen: 95-100%
- Heart Rate: 60-100 bpm
- No alerts

### Warning
- Oxygen: 90-94%
- Heart Rate: 55-59 or 101-110 bpm
- Approaching thresholds

### Critical
- Oxygen: <90%
- Heart Rate: <55 or >110 bpm
- Alert triggered

### Erratic
- Random fluctuations
- Simulates sensor malfunction

### Offline
- No data sent
- Simulates disconnection

## Configuration

### Sensor Fleet Configuration (config/sensors.json)

```json
{
  "sensors": [
    {
      "sensor_id": "SENSOR_001",
      "patient_id": "P12345",
      "interval": 5000,
      "behavior": "normal"
    },
    {
      "sensor_id": "SENSOR_002",
      "patient_id": "P67890",
      "interval": 5000,
      "behavior": "warning"
    }
  ]
}
```

## Test Scenarios

### Scenario 1: Normal Operation
- All sensors functioning normally
- Regular readings every 5 seconds
- No alerts

### Scenario 2: Gradual Deterioration
- Patient vitals slowly decline
- Transition from normal → warning → critical
- Alerts triggered appropriately

### Scenario 3: Sudden Crisis
- Instant critical readings
- Immediate alert generation
- Test emergency response

### Scenario 4: Sensor Offline
- Sensor stops sending data
- Backend detects offline status (15 sec timeout)
- Test offline notification

### Scenario 5: Load Testing
- 50-100 sensors sending data simultaneously
- Test system performance under load
- Monitor API response times

## API Integration

Mock sensors communicate with the backend API:

**POST /api/v1/sensors/data**
```json
{
  "sensor_id": "SENSOR_001",
  "oxygen_level": 97.5,
  "heart_rate": 72,
  "timestamp": "2025-11-22T10:30:15.123Z"
}
```

**POST /api/v1/sensors/alert**
```json
{
  "sensor_id": "SENSOR_001",
  "alert_type": "button_pressed",
  "timestamp": "2025-11-22T10:30:20.000Z"
}
```

## Testing with Mock Sensors

### Integration Testing
```bash
# Start backend server
cd ../backend && npm run dev

# Start mock sensors
cd ../mock-sensors && npm start

# Run integration tests
npm test
```

### Load Testing
```bash
# Start 100 sensors
npm run cli -- start-fleet --count 100

# Monitor backend performance
# Check database for data integrity
```

## Next Steps for Test Automation Expert

1. Implement `MockSensor` class with configurable behaviors
2. Create CLI for sensor control
3. Implement predefined test scenarios
4. Build sensor fleet management
5. Add data generation algorithms (realistic vital signs)
6. Implement alert triggering
7. Create load testing scripts
8. Write integration tests for backend API
9. Document test scenarios and usage
10. Create automated test suites

---

**Assigned to:** Test Automation Expert
