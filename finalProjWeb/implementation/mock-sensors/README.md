# Mock Sensor Framework

Test automation framework that simulates ESP32 IoT sensors for the Nursing Station Dashboard.

## Overview

This mock framework simulates the behavior of ESP32 sensors that measure patient vital signs. It allows for comprehensive testing without requiring physical hardware. The framework is **complete and ready for testing**.

## Features

- **7 Behavior Modes**: normal, warning, critical, deteriorating, erratic, stable-low, stable-high, offline
- **Realistic Vital Signs**: O2 saturation, heart rate, temperature with appropriate ranges and noise
- **Button Alert Simulation**: Trigger emergency button presses
- **Fleet Management**: Control multiple sensors simultaneously via CLI
- **CLI Interface**: Comprehensive command-line interface for testing scenarios
- **Programmatic API**: Use as Node.js module for custom test scripts
- **Real-time Updates**: Configurable intervals (default: 5 seconds)

## Directory Structure

```
mock-sensors/
├── src/
│   ├── MockSensor.js   # ✅ Sensor simulation class (complete)
│   ├── cli.js          # ✅ Command-line interface (complete)
│   └── index.js        # ✅ Module entry point (complete)
├── package.json        # Dependencies
└── README.md
```

## Installation

```bash
npm install
```

## Quick Start

```bash
# Ensure backend is running
cd ../backend && npm run dev

# In another terminal, start a single sensor
cd ../mock-sensors
node src/cli.js start --sensor-id ESP32-VS-001 --behavior normal

# In another terminal, start a fleet of 10 sensors
node src/cli.js start-fleet --count 10 --prefix ESP32-VS
```

## CLI Usage

### Start a Single Sensor

```bash
node src/cli.js start --sensor-id ESP32-VS-001 --interval 5000 --behavior normal
```

Options:
- `--sensor-id`: Unique identifier (required)
- `--interval`: Milliseconds between readings (default: 5000)
- `--behavior`: Initial behavior mode (default: normal)

### Start a Fleet

```bash
# Start 10 sensors with automatic IDs (ESP32-VS-001 through ESP32-VS-010)
node src/cli.js start-fleet --count 10 --prefix ESP32-VS --interval 5000
```

Options:
- `--count`: Number of sensors to start (required)
- `--prefix`: ID prefix (default: SENSOR)
- `--interval`: Milliseconds between readings (default: 5000)

### Change Behavior

```bash
node src/cli.js behavior --sensor-id ESP32-VS-001 --mode critical
```

### Trigger Button Alert

```bash
node src/cli.js alert --sensor-id ESP32-VS-001
```

### Check Status

```bash
# Single sensor
node src/cli.js status --sensor-id ESP32-VS-001

# All sensors
node src/cli.js status
```

### List Active Sensors

```bash
node src/cli.js list
```

### Stop Sensors

```bash
# Stop specific sensor
node src/cli.js stop --sensor-id ESP32-VS-001

# Stop all sensors
node src/cli.js stop-all

# Or press Ctrl+C to stop all
```

### Help

```bash
node src/cli.js help
```

## Programmatic Usage

```javascript
const MockSensor = require('./src/index');

// Create sensor instance
const sensor = new MockSensor({
  sensor_id: 'ESP32-VS-001',
  interval: 5000,
  behavior: 'normal',
  apiBaseUrl: 'http://localhost:3000/api/v1'
});

// Start sending data
sensor.start();

// Change behavior after 30 seconds
setTimeout(() => {
  sensor.setBehavior('critical');
}, 30000);

// Trigger emergency button
sensor.sendButtonAlert();

// Check status
const status = sensor.getStatus();
console.log(status);

// Stop sensor
sensor.stop();
```

## Behavior Modes

| Mode | Description | O2 Range | HR Range | Temp Range | Use Case |
|------|-------------|----------|----------|------------|----------|
| `normal` | Healthy patient | 95-100% | 60-100 bpm | 36.1-37.8°C | Baseline testing |
| `warning` | Approaching limits | 90-94% | 55-59 or 101-110 | 37.9-38.2°C | Early warning testing |
| `critical` | Triggers alerts | 85-89% | 45-54 or 111-130 | 38.3-39.0°C | Alert system testing |
| `deteriorating` | Gradual decline | Declining over 20 readings | Declining | Declining | Long-term monitoring |
| `erratic` | Random fluctuations | 80-100% | 40-140 | 36-39°C | Malfunction scenarios |
| `stable-low` | Consistently low | 92-94% | 55-60 | 36.1-36.5°C | Chronic condition |
| `stable-high` | Consistently high | 96-98% | 95-105 | 37.2-37.8°C | Post-surgery |
| `offline` | No data sent | - | - | - | Connection loss testing |

## Testing Scenarios

### Scenario 1: Normal Operation
```bash
node src/cli.js start-fleet --count 5 --prefix ESP32-VS
```
Expected: All sensors send normal readings, no alerts triggered

### Scenario 2: Gradual Deterioration
```bash
node src/cli.js start --sensor-id ESP32-VS-001 --behavior normal
# Wait 30 seconds, then:
node src/cli.js behavior --sensor-id ESP32-VS-001 --mode deteriorating
```
Expected: Vitals decline gradually, alerts triggered as thresholds crossed

### Scenario 3: Sudden Crisis
```bash
node src/cli.js start --sensor-id ESP32-VS-001 --behavior normal
# Then immediately:
node src/cli.js behavior --sensor-id ESP32-VS-001 --mode critical
```
Expected: Instant critical readings, immediate alert generation

### Scenario 4: Emergency Button
```bash
node src/cli.js start --sensor-id ESP32-VS-001 --behavior normal
node src/cli.js alert --sensor-id ESP32-VS-001
```
Expected: Button press alert logged, nurse notified

### Scenario 5: Sensor Malfunction
```bash
node src/cli.js start --sensor-id ESP32-VS-001 --behavior erratic
```
Expected: Random fluctuating values, possible alerts

### Scenario 6: Sensor Offline
```bash
node src/cli.js start --sensor-id ESP32-VS-001 --behavior offline
```
Expected: No data sent, backend detects offline status after 15 seconds

### Scenario 7: Load Testing
```bash
node src/cli.js start-fleet --count 30 --interval 3000
```
Expected: System handles high data volume, no dropped readings

## API Integration

Mock sensors communicate with the backend API:

**POST /api/v1/sensors/data**
```json
{
  "sensor_id": "ESP32-VS-001",
  "oxygen_level": 97.5,
  "heart_rate": 72,
  "temperature": 37.2,
  "timestamp": "2025-11-22T10:30:15.123Z"
}
```

**POST /api/v1/sensors/alert**
```json
{
  "sensor_id": "ESP32-VS-001",
  "alert_type": "button_pressed",
  "timestamp": "2025-11-22T10:30:20.000Z"
}
```

## Environment Variables

```bash
API_BASE_URL=http://localhost:3000/api/v1
```

## Troubleshooting

**Connection Errors:**
```
Error: connect ECONNREFUSED
```
Solution: Ensure backend is running on http://localhost:3000

**Sensor Already Running:**
```
Error: Sensor ESP32-VS-001 is already running
```
Solution: Stop the sensor first with `node src/cli.js stop --sensor-id ESP32-VS-001`

**Invalid Behavior Mode:**
The sensor will log a warning but continue with current behavior.

## Implementation Details

### MockSensor Class

**Constructor Options:**
- `sensor_id` (required): Unique sensor identifier
- `interval` (default: 5000): Milliseconds between readings
- `behavior` (default: 'normal'): Initial behavior mode
- `apiBaseUrl` (required): Backend API URL

**Methods:**
- `start()`: Begin sending readings at configured interval
- `stop()`: Stop transmission and clear interval
- `setBehavior(mode)`: Change behavior dynamically
- `generateReading()`: Create realistic data based on behavior
- `sendReading()`: POST reading to backend API
- `sendButtonAlert()`: POST button press alert
- `getStatus()`: Get current sensor state

**Error Handling:**
- Catches server errors (500, 400, etc.)
- Handles network failures
- Logs all errors with sensor_id prefix
- Continues running despite errors

---

**Status**: ✅ Complete and Ready for Testing
