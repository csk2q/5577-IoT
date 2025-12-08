#!/usr/bin/env node

/**
 * Mock Sensor CLI
 * Command-line interface for controlling mock IoT sensors
 */

const MockSensor = require('./MockSensor');

// Store active sensors
const activeSensors = new Map();

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

// API base URL from environment or default
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';

/**
 * Display help information
 */
function showHelp() {
  console.log(`
Mock Sensor CLI - IoT Sensor Simulator
=======================================

Usage: node cli.js <command> [options]

Commands:

  start --sensor-id <id> [--interval <ms>] [--behavior <mode>] [--button-press-interval <ms>]
    Start a single sensor
    Example: node cli.js start --sensor-id ESP32-VS-001 --interval 5000 --behavior normal
    Example: node cli.js start --sensor-id ESP32-VS-001 --button-press-interval 30000

  start-fleet --count <n> [--prefix <prefix>] [--interval <ms>]
    Start multiple sensors
    Example: node cli.js start-fleet --count 10 --prefix ESP32-VS

  stop --sensor-id <id>
    Stop a specific sensor
    Example: node cli.js stop --sensor-id ESP32-VS-001

  stop-all
    Stop all running sensors
    Example: node cli.js stop-all

  behavior --sensor-id <id> --mode <mode>
    Change sensor behavior
    Example: node cli.js behavior --sensor-id ESP32-VS-001 --mode critical

  alert --sensor-id <id>
    Trigger button press alert
    Example: node cli.js alert --sensor-id ESP32-VS-001

  status [--sensor-id <id>]
    Show sensor status
    Example: node cli.js status --sensor-id ESP32-VS-001

  list
    List all active sensors
    Example: node cli.js list

Behavior Modes:
  normal        - Healthy vital signs (95-100% O2, 60-100 bpm HR)
  warning       - Approaching thresholds (90-94% O2, 55-59 or 101-110 bpm)
  critical      - Critical values that trigger alerts (<90% O2, <55 or >110 bpm)
  deteriorating - Gradual decline from normal to critical
  erratic       - Random fluctuations (sensor malfunction)
  stable-low    - Stable but low values
  stable-high   - Stable but high values
  offline       - Sensor stops sending data

Environment Variables:
  API_BASE_URL  - Backend API URL (default: http://localhost:3000/api/v1)

Examples:
  # Start a single sensor with normal behavior
  node cli.js start --sensor-id ESP32-VS-001

  # Start 10 sensors for load testing
  node cli.js start-fleet --count 10

  # Change sensor to critical state
  node cli.js behavior --sensor-id ESP32-VS-001 --mode critical

  # Trigger emergency button
  node cli.js alert --sensor-id ESP32-VS-001
`);
}

/**
 * Parse command line options
 */
function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    options[key] = value;
  }
  return options;
}

/**
 * Start a single sensor
 */
function startSensor(options) {
  const sensorId = options['sensor-id'];
  const interval = parseInt(options.interval) || 5000;
  const behavior = options.behavior || 'normal';
  const buttonPressInterval = options['button-press-interval'] ? parseInt(options['button-press-interval']) : 0;

  if (!sensorId) {
    console.error('Error: --sensor-id is required');
    process.exit(1);
  }

  if (activeSensors.has(sensorId)) {
    console.error(`Error: Sensor ${sensorId} is already running`);
    process.exit(1);
  }

  const sensor = new MockSensor({
    sensor_id: sensorId,
    interval,
    behavior,
    buttonPressInterval,
    apiBaseUrl: API_BASE_URL
  });

  sensor.start();
  activeSensors.set(sensorId, sensor);

  console.log(`\nSensor ${sensorId} started successfully!`);
  console.log(`Press Ctrl+C to stop\n`);
}

/**
 * Start a fleet of sensors
 */
function startFleet(options) {
  const count = parseInt(options.count);
  const prefix = options.prefix || 'SENSOR';
  const interval = parseInt(options.interval) || 5000;

  if (!count || count < 1) {
    console.error('Error: --count must be a positive number');
    process.exit(1);
  }

  console.log(`Starting fleet of ${count} sensors...`);

  for (let i = 1; i <= count; i++) {
    const sensorId = `${prefix}-${String(i).padStart(3, '0')}`;
    
    const sensor = new MockSensor({
      sensor_id: sensorId,
      interval,
      behavior: 'normal',
      apiBaseUrl: API_BASE_URL
    });

    sensor.start();
    activeSensors.set(sensorId, sensor);
  }

  console.log(`\n✓ Started ${count} sensors`);
  console.log(`Press Ctrl+C to stop all sensors\n`);
}

/**
 * Stop a specific sensor
 */
function stopSensor(options) {
  const sensorId = options['sensor-id'];

  if (!sensorId) {
    console.error('Error: --sensor-id is required');
    process.exit(1);
  }

  const sensor = activeSensors.get(sensorId);
  if (!sensor) {
    console.error(`Error: Sensor ${sensorId} is not running`);
    process.exit(1);
  }

  sensor.stop();
  activeSensors.delete(sensorId);
  console.log(`✓ Sensor ${sensorId} stopped`);
}

/**
 * Stop all sensors
 */
function stopAll() {
  console.log(`Stopping ${activeSensors.size} sensors...`);
  
  activeSensors.forEach((sensor, sensorId) => {
    sensor.stop();
  });
  
  activeSensors.clear();
  console.log('✓ All sensors stopped');
  process.exit(0);
}

/**
 * Change sensor behavior
 */
function changeBehavior(options) {
  const sensorId = options['sensor-id'];
  const mode = options.mode;

  if (!sensorId || !mode) {
    console.error('Error: --sensor-id and --mode are required');
    process.exit(1);
  }

  const sensor = activeSensors.get(sensorId);
  if (!sensor) {
    console.error(`Error: Sensor ${sensorId} is not running`);
    process.exit(1);
  }

  sensor.setBehavior(mode);
  console.log(`✓ Sensor ${sensorId} behavior changed to ${mode}`);
}

/**
 * Trigger button alert
 */
async function triggerAlert(options) {
  const sensorId = options['sensor-id'];

  if (!sensorId) {
    console.error('Error: --sensor-id is required');
    process.exit(1);
  }

  const sensor = activeSensors.get(sensorId);
  if (!sensor) {
    console.error(`Error: Sensor ${sensorId} is not running`);
    process.exit(1);
  }

  await sensor.sendButtonAlert();
  console.log(`✓ Button alert sent from ${sensorId}`);
}

/**
 * Show sensor status
 */
function showStatus(options) {
  const sensorId = options['sensor-id'];

  if (sensorId) {
    const sensor = activeSensors.get(sensorId);
    if (!sensor) {
      console.error(`Error: Sensor ${sensorId} is not running`);
      process.exit(1);
    }

    const status = sensor.getStatus();
    console.log('\nSensor Status:');
    console.log(`  ID: ${status.sensor_id}`);
    console.log(`  Running: ${status.isRunning}`);
    console.log(`  Behavior: ${status.behavior}`);
    console.log(`  Interval: ${status.interval}ms`);
    console.log(`  Readings Sent: ${status.readingCount}`);
  } else {
    // Show all sensors
    if (activeSensors.size === 0) {
      console.log('No sensors currently running');
    } else {
      console.log(`\nActive Sensors (${activeSensors.size}):`);
      activeSensors.forEach((sensor, sensorId) => {
        const status = sensor.getStatus();
        console.log(`  ${sensorId}: ${status.behavior} (${status.readingCount} readings)`);
      });
    }
  }
}

/**
 * List all active sensors
 */
function listSensors() {
  if (activeSensors.size === 0) {
    console.log('No sensors currently running');
    return;
  }

  console.log(`\nActive Sensors (${activeSensors.size}):\n`);
  activeSensors.forEach((sensor, sensorId) => {
    const status = sensor.getStatus();
    console.log(`  ${sensorId}`);
    console.log(`    Behavior: ${status.behavior}`);
    console.log(`    Interval: ${status.interval}ms`);
    console.log(`    Readings: ${status.readingCount}`);
    console.log('');
  });
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  stopAll();
});

// Main command router
const options = parseOptions(args.slice(1));

switch (command) {
  case 'start':
    startSensor(options);
    break;

  case 'start-fleet':
    startFleet(options);
    break;

  case 'stop':
    stopSensor(options);
    process.exit(0);
    break;

  case 'stop-all':
    stopAll();
    break;

  case 'behavior':
    changeBehavior(options);
    break;

  case 'alert':
    triggerAlert(options).then(() => process.exit(0));
    break;

  case 'status':
    showStatus(options);
    process.exit(0);
    break;

  case 'list':
    listSensors();
    process.exit(0);
    break;

  case 'help':
  case '--help':
  case '-h':
  default:
    showHelp();
    process.exit(command ? 1 : 0);
}
