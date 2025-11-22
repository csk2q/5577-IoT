/**
 * Mock Sensor Module
 * 
 * Provides programmatic access to the MockSensor class for simulating
 * IoT sensor behavior in testing and development environments.
 * 
 * @module mock-sensors
 */

const MockSensor = require('./MockSensor');

module.exports = MockSensor;

/**
 * Example Usage:
 * 
 * const MockSensor = require('./src/index');
 * 
 * // Create and start a sensor with normal behavior
 * const sensor = new MockSensor({
 *   sensor_id: 'ESP32-VS-001',
 *   interval: 5000,
 *   behavior: 'normal',
 *   apiBaseUrl: 'http://localhost:3000/api/v1'
 * });
 * 
 * sensor.start();
 * 
 * // Change behavior after 30 seconds
 * setTimeout(() => {
 *   sensor.setBehavior('critical');
 * }, 30000);
 * 
 * // Trigger button alert
 * setTimeout(() => {
 *   sensor.sendButtonAlert();
 * }, 60000);
 * 
 * // Stop after 2 minutes
 * setTimeout(() => {
 *   sensor.stop();
 *   console.log('Sensor stopped');
 *   process.exit(0);
 * }, 120000);
 */
