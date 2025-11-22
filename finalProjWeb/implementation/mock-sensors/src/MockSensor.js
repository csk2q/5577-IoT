/**
 * MockSensor - Simulates ESP32 IoT sensor behavior
 * 
 * Sends realistic vital signs data to the backend API every 5 seconds.
 * Supports multiple behavior modes for testing different scenarios.
 */

const axios = require('axios');

class MockSensor {
  /**
   * Create a new mock sensor
   * @param {Object} options - Configuration options
   * @param {string} options.sensor_id - Unique sensor identifier (e.g., "ESP32-VS-001")
   * @param {number} [options.interval=5000] - Data transmission interval in milliseconds
   * @param {string} [options.behavior='normal'] - Sensor behavior mode
   * @param {string} [options.apiBaseUrl='http://localhost:3000/api/v1'] - Backend API URL
   */
  constructor(options) {
    this.sensor_id = options.sensor_id;
    this.interval = options.interval || 5000;
    this.behavior = options.behavior || 'normal';
    this.apiBaseUrl = options.apiBaseUrl || 'http://localhost:3000/api/v1';
    
    this.isRunning = false;
    this.intervalId = null;
    this.readingCount = 0;
    
    // Initialize baseline values
    this.baselineOxygen = 97;
    this.baselineHeartRate = 75;
    this.baselineTemp = 36.8;
    
    console.log(`[${this.sensor_id}] Mock sensor created (behavior: ${this.behavior})`);
  }

  /**
   * Start sending sensor data
   */
  start() {
    if (this.isRunning) {
      console.log(`[${this.sensor_id}] Already running`);
      return;
    }

    this.isRunning = true;
    console.log(`[${this.sensor_id}] Starting... sending data every ${this.interval}ms`);
    
    // Send first reading immediately
    this.sendReading();
    
    // Then send at regular intervals
    this.intervalId = setInterval(() => {
      this.sendReading();
    }, this.interval);
  }

  /**
   * Stop sending sensor data
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log(`[${this.sensor_id}] Stopped after ${this.readingCount} readings`);
  }

  /**
   * Change sensor behavior
   * @param {string} behavior - New behavior mode
   */
  setBehavior(behavior) {
    console.log(`[${this.sensor_id}] Changing behavior: ${this.behavior} → ${behavior}`);
    this.behavior = behavior;
  }

  /**
   * Generate sensor reading based on current behavior
   * @returns {Object} Sensor reading data
   */
  generateReading() {
    let oxygen, heartRate, temperature;

    switch (this.behavior) {
      case 'normal':
        // Normal healthy ranges
        oxygen = this.randomInRange(95, 100);
        heartRate = this.randomInRange(60, 100);
        temperature = this.randomInRange(36.1, 37.8);
        break;

      case 'warning':
        // Approaching threshold limits
        oxygen = this.randomInRange(90, 94);
        heartRate = Math.random() < 0.5
          ? this.randomInRange(55, 59)  // Low heart rate
          : this.randomInRange(101, 110); // High heart rate
        temperature = Math.random() < 0.5
          ? this.randomInRange(35.5, 36.0)  // Low temp
          : this.randomInRange(37.9, 38.5); // High temp
        break;

      case 'critical':
        // Critical values that should trigger alerts
        oxygen = this.randomInRange(85, 89);
        heartRate = Math.random() < 0.5
          ? this.randomInRange(45, 54)   // Very low
          : this.randomInRange(111, 130); // Very high
        temperature = Math.random() < 0.5
          ? this.randomInRange(34.0, 35.4)  // Hypothermia
          : this.randomInRange(38.6, 40.0); // Fever
        break;

      case 'deteriorating':
        // Gradual decline from normal to critical
        const progress = this.readingCount % 20 / 20; // 0 to 1 over 20 readings
        oxygen = this.randomInRange(100 - (progress * 10), 100 - (progress * 5));
        heartRate = this.randomInRange(75 + (progress * 30), 85 + (progress * 30));
        temperature = this.randomInRange(36.8 + (progress * 2), 37.2 + (progress * 2));
        break;

      case 'erratic':
        // Random fluctuations (sensor malfunction simulation)
        oxygen = this.randomInRange(80, 100);
        heartRate = this.randomInRange(40, 140);
        temperature = this.randomInRange(35, 40);
        break;

      case 'stable-low':
        // Stable but low values
        oxygen = this.randomInRange(92, 94);
        heartRate = this.randomInRange(55, 60);
        temperature = this.randomInRange(36.0, 36.5);
        break;

      case 'stable-high':
        // Stable but high values
        oxygen = this.randomInRange(96, 98);
        heartRate = this.randomInRange(95, 105);
        temperature = this.randomInRange(37.5, 38.0);
        break;

      default:
        // Default to normal
        oxygen = this.randomInRange(95, 100);
        heartRate = this.randomInRange(60, 100);
        temperature = this.randomInRange(36.1, 37.8);
    }

    return {
      sensor_id: this.sensor_id,
      oxygen_level: parseFloat(oxygen.toFixed(1)),
      heart_rate: Math.round(heartRate),
      temperature: parseFloat(temperature.toFixed(1)),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Send reading to backend API
   */
  async sendReading() {
    if (this.behavior === 'offline') {
      // Simulate offline sensor - don't send data
      return;
    }

    try {
      const reading = this.generateReading();
      
      const response = await axios.post(
        `${this.apiBaseUrl}/sensors/data`,
        reading,
        {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      this.readingCount++;
      
      if (response.data.success) {
        console.log(
          `[${this.sensor_id}] ✓ Reading ${this.readingCount}: ` +
          `O2=${reading.oxygen_level}% HR=${reading.heart_rate}bpm T=${reading.temperature}°C`
        );
      }
    } catch (error) {
      if (error.response) {
        // Server responded with error
        console.error(
          `[${this.sensor_id}] ✗ Server error: ${error.response.status} - ` +
          `${error.response.data?.error?.message || error.message}`
        );
      } else if (error.request) {
        // No response received
        console.error(`[${this.sensor_id}] ✗ No response from server (is backend running?)`);
      } else {
        // Request setup error
        console.error(`[${this.sensor_id}] ✗ Request error: ${error.message}`);
      }
    }
  }

  /**
   * Send button press alert to backend
   */
  async sendButtonAlert() {
    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/sensors/alert`,
        {
          sensor_id: this.sensor_id,
          alert_type: 'button_pressed',
          timestamp: new Date().toISOString()
        },
        {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        console.log(`[${this.sensor_id}] 🔴 Button press alert sent`);
      }
    } catch (error) {
      console.error(`[${this.sensor_id}] ✗ Failed to send button alert: ${error.message}`);
    }
  }

  /**
   * Generate random number in range
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Random number in range
   */
  randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  /**
   * Get sensor status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      sensor_id: this.sensor_id,
      isRunning: this.isRunning,
      behavior: this.behavior,
      interval: this.interval,
      readingCount: this.readingCount
    };
  }
}

module.exports = MockSensor;
