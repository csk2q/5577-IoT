// =============================================================================
// DHT Sensor Monitoring System for ESP32
// =============================================================================
// Professional single-file implementation with modular structure
// Features: Temperature/Humidity monitoring, WiFi, Web server, Data encryption
// =============================================================================

#include <DHT.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "mbedtls/aes.h"
#include "Base64.h"
#include <WebServer.h>

// =============================================================================
// Configuration Constants
// =============================================================================

// Device Identity
const char* DEVICE_NAME = "DHT11 Sensor Monitor";

// Hardware Configuration
const uint8_t LED_PIN = 2;
const uint8_t DHT_PIN = 4;
const uint8_t DHT_TYPE = DHT11;

// Security Configuration
const unsigned char AES_KEY[16] = { 
    '1','2','3','4','5','6','7','8','9','0','a','b','c','d','e','f' 
};
const unsigned char AES_IV[16] = { 
    'a','b','c','d','e','f','1','2','3','4','5','6','7','8','9','0' 
};

// Default Thresholds
const float DEFAULT_TEMP_LOW = 15.0;
const float DEFAULT_TEMP_HIGH = 30.0;
const float DEFAULT_HUMIDITY_LOW = 30.0;
const float DEFAULT_HUMIDITY_HIGH = 70.0;

// Timing Constants
const unsigned long SENSOR_READ_INTERVAL_MS = 1000;
const unsigned long SERIAL_BAUD_RATE = 115200;
const unsigned long CONFIG_TIMEOUT_MS = 120000; // 2 minutes for configuration

// =============================================================================
// Data Structures
// =============================================================================

struct SensorData {
    float temperature;
    float humidity;
    unsigned long timestamp;
};

struct CalibrationData {
    float temperatureOffset;
    float humidityOffset;
};

struct ThresholdData {
    float tempLow;
    float tempHigh;
    float humidityLow;
    float humidityHigh;
};

struct NetworkConfig {
    String ssid;
    String password;
    String serverUrl;
};

// =============================================================================
// Global Variables
// =============================================================================

// Hardware Objects
DHT dhtSensor(DHT_PIN, DHT_TYPE);
WebServer webServer(80);

// Application State
bool isReadingData = false;
unsigned long lastSensorReadTime = 0;

// Configuration Data
CalibrationData calibration = {0, 0};
ThresholdData thresholds = {
    DEFAULT_TEMP_LOW, 
    DEFAULT_TEMP_HIGH, 
    DEFAULT_HUMIDITY_LOW, 
    DEFAULT_HUMIDITY_HIGH
};

// Network Configuration (set via serial)
NetworkConfig networkConfig;

// =============================================================================
// Serial Configuration Functions
// =============================================================================

String readSerialLine(unsigned long timeoutMs = 30000) {
    String input = "";
    unsigned long startTime = millis();
    
    while (millis() - startTime < timeoutMs) {
        if (Serial.available()) {
            char c = Serial.read();
            if (c == '\n' || c == '\r') {
                if (input.length() > 0) {
                    break;
                }
                // If we get just CR/LF with no content, continue waiting
                continue;
            } else {
                input += c;
            }
        }
        delay(10);
    }
    
    input.trim();
    return input;
}

bool promptForConfiguration() {
    Serial.println("\n" + String(DEVICE_NAME));
    Serial.println("==========================================");
    Serial.println("NETWORK CONFIGURATION SETUP");
    Serial.println("==========================================");
    Serial.println("Please enter your network configuration:");
    Serial.println("(You have 2 minutes for each prompt)");
    Serial.println();

    // WiFi SSID
    Serial.println("Enter WiFi SSID:");
    networkConfig.ssid = readSerialLine(CONFIG_TIMEOUT_MS);
    if (networkConfig.ssid.length() == 0) {
        Serial.println("✗ No SSID provided. Using default: 'ESP32-DHT'");
        networkConfig.ssid = "ESP32-DHT";
    } else {
        Serial.println("✓ SSID: " + networkConfig.ssid);
    }

    // WiFi Password
    Serial.println("Enter WiFi Password (press Enter for open network):");
    networkConfig.password = readSerialLine(CONFIG_TIMEOUT_MS);
    if (networkConfig.password.length() == 0) {
        Serial.println("✓ No password - using open network");
    } else {
        Serial.println("✓ Password provided");
    }

    // Server URL
    Serial.println("Enter Server URL (e.g., http://192.168.1.100:8888/post-data):");
    networkConfig.serverUrl = readSerialLine(CONFIG_TIMEOUT_MS);
    if (networkConfig.serverUrl.length() == 0) {
        Serial.println("✗ No server URL provided. Using default.");
        networkConfig.serverUrl = "http://192.168.1.100:8888/post-data";
    } else {
        Serial.println("✓ Server URL: " + networkConfig.serverUrl);
    }

    // Confirm configuration
    Serial.println("\n==========================================");
    Serial.println("CONFIGURATION SUMMARY:");
    Serial.println("==========================================");
    Serial.println("WiFi SSID: " + networkConfig.ssid);
    Serial.println("WiFi Password: " + String(networkConfig.password.length() > 0 ? "***" : "[None]"));
    Serial.println("Server URL: " + networkConfig.serverUrl);
    Serial.println("==========================================");
    Serial.println("Type 'Y' to confirm or 'N' to restart configuration:");

    String confirmation = readSerialLine(CONFIG_TIMEOUT_MS);
    confirmation.toLowerCase();
    
    if (confirmation == "y" || confirmation == "yes") {
        Serial.println("✓ Configuration confirmed!");
        return true;
    } else {
        Serial.println("✗ Configuration cancelled. Restarting...");
        return false;
    }
}

void waitForSerialConnection() {
    Serial.begin(SERIAL_BAUD_RATE);
    delay(2000); // Give more time for serial to initialize
    
    unsigned long startTime = millis();
    Serial.println("Waiting for serial connection...");
    
    // Wait for serial connection or timeout
    while (millis() - startTime < 10000) { // 10 second timeout
        if (Serial) {
            break;
        }
        delay(100);
    }
    
    // Flush any existing data in serial buffer
    while (Serial.available() > 0) {
        Serial.read();
    }
}

// =============================================================================
// Core Hardware Functions
// =============================================================================

void initializeHardware() {
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
    dhtSensor.begin();
}

void setLED(bool state) {
    digitalWrite(LED_PIN, state);
}

void toggleLED() {
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
}

// =============================================================================
// Network Functions
// =============================================================================

bool connectToWiFi() {
    if (networkConfig.ssid.length() == 0) {
        Serial.println("✗ No WiFi configuration available");
        return false;
    }
    
    Serial.print("Connecting to: ");
    Serial.println(networkConfig.ssid);
    
    // Handle open network (no password)
    if (networkConfig.password.length() == 0) {
        WiFi.begin(networkConfig.ssid.c_str());
    } else {
        WiFi.begin(networkConfig.ssid.c_str(), networkConfig.password.c_str());
    }
    
    unsigned long startTime = millis();
    bool connected = false;
    
    while (millis() - startTime < 20000) { // 20 second timeout
        if (WiFi.status() == WL_CONNECTED) {
            connected = true;
            break;
        }
        delay(500);
        Serial.print(".");
    }
    
    if (connected) {
        Serial.println("\n✓ WiFi connected");
        Serial.print("IP Address: ");
        Serial.println(WiFi.localIP());
        return true;
    } else {
        Serial.println("\n✗ WiFi connection failed");
        return false;
    }
}

bool isWiFiConnected() {
    return WiFi.status() == WL_CONNECTED;
}

// =============================================================================
// Sensor Management Functions
// =============================================================================

bool readSensorData(SensorData& data) {
    float humidity = dhtSensor.readHumidity();
    float temperature = dhtSensor.readTemperature();
    
    if (isnan(humidity) || isnan(temperature)) {
        Serial.println("✗ Failed to read sensor data");
        return false;
    }
    
    // Apply calibration offsets
    data.temperature = temperature - calibration.temperatureOffset;
    data.humidity = humidity - calibration.humidityOffset;
    data.timestamp = millis();
    
    return true;
}

void displaySensorData(const SensorData& data) {
    Serial.print("Humidity: ");
    Serial.print(data.humidity);
    Serial.print("%  Temperature: ");
    Serial.print(data.temperature);
    Serial.println("°C");
}

// =============================================================================
// Calibration Functions
// =============================================================================

bool performCalibration(float actualTemperature, float actualHumidity) {
    SensorData currentReading;
    if (!readSensorData(currentReading)) {
        Serial.println("✗ Calibration failed: Could not read sensor data");
        return false;
    }
    
    // Calculate new offsets
    calibration.temperatureOffset = currentReading.temperature - actualTemperature;
    calibration.humidityOffset = currentReading.humidity - actualHumidity;
    
    Serial.println("✓ Calibration completed successfully:");
    Serial.printf("  Temperature offset: %.2f°C\n", calibration.temperatureOffset);
    Serial.printf("  Humidity offset: %.2f%%\n", calibration.humidityOffset);
    Serial.printf("  New calibrated values - Temp: %.1f°C, Humidity: %.1f%%\n", 
                  actualTemperature, actualHumidity);
    
    return true;
}

// =============================================================================
// LED Control Functions
// =============================================================================

void updateLEDBasedOnData(const SensorData& data) {
    if (data.temperature < thresholds.tempLow || data.humidity < thresholds.humidityLow) {
        // Below thresholds: blink LED
        toggleLED();
    } else if (data.temperature > thresholds.tempHigh || data.humidity > thresholds.humidityHigh) {
        // Above thresholds: LED ON
        setLED(true);
    } else {
        // Within normal range: LED OFF
        setLED(false);
    }
}

// =============================================================================
// Data Encryption Functions
// =============================================================================

String encryptData(const String& plainText) {
    size_t inputLen = plainText.length();
    size_t paddedLen = ((inputLen + 15) / 16) * 16;
    
    unsigned char input[paddedLen];
    unsigned char output[paddedLen];
    memset(input, 0, paddedLen);
    memcpy(input, plainText.c_str(), inputLen);
    
    mbedtls_aes_context aes;
    mbedtls_aes_init(&aes);
    mbedtls_aes_setkey_enc(&aes, AES_KEY, 128);
    
    unsigned char iv[16];
    memcpy(iv, AES_IV, 16);
    
    mbedtls_aes_crypt_cbc(&aes, MBEDTLS_AES_ENCRYPT, paddedLen, iv, input, output);
    mbedtls_aes_free(&aes);
    
    return base64::encode(output, paddedLen);
}

// =============================================================================
// Data Transmission Functions
// =============================================================================

String createJSONPayload(const SensorData& data) {
    StaticJsonDocument<200> doc;
    doc["team_number"] = 2;
    doc["temperature"] = data.temperature;
    doc["humidity"] = data.humidity;
    doc["timestamp"] = data.timestamp;
    
    String jsonString;
    serializeJson(doc, jsonString);
    return jsonString;
}

String createCalibrationJSONPayload() {
    StaticJsonDocument<300> doc;
    doc["calibration"]["temperature_offset"] = calibration.temperatureOffset;
    doc["calibration"]["humidity_offset"] = calibration.humidityOffset;
    doc["calibration"]["current_temperature_raw"] = dhtSensor.readTemperature();
    doc["calibration"]["current_humidity_raw"] = dhtSensor.readHumidity();
    
    SensorData calibrated;
    if (readSensorData(calibrated)) {
        doc["calibration"]["current_temperature_calibrated"] = calibrated.temperature;
        doc["calibration"]["current_humidity_calibrated"] = calibrated.humidity;
    }
    
    String jsonString;
    serializeJson(doc, jsonString);
    return jsonString;
}

String createThresholdsJSONPayload() {
    StaticJsonDocument<300> doc;
    doc["thresholds"]["temp_low"] = thresholds.tempLow;
    doc["thresholds"]["temp_high"] = thresholds.tempHigh;
    doc["thresholds"]["humidity_low"] = thresholds.humidityLow;
    doc["thresholds"]["humidity_high"] = thresholds.humidityHigh;
    
    String jsonString;
    serializeJson(doc, jsonString);
    return jsonString;
}

bool transmitSensorData(const SensorData& data) {
    if (!isWiFiConnected()) {
        Serial.println("✗ WiFi not connected - cannot transmit data");
        return false;
    }
    
    if (networkConfig.serverUrl.length() == 0) {
        Serial.println("✗ No server URL configured");
        return false;
    }
    
    HTTPClient http;
    http.begin(networkConfig.serverUrl.c_str());
    http.addHeader("Content-Type", "text/plain");
    
    String jsonData = createJSONPayload(data);
    String encryptedData = encryptData(jsonData);
    
    int responseCode = http.POST(encryptedData);
    http.end();
    
    if (responseCode > 0) {
        Serial.println("✓ Data transmitted successfully");
        return true;
    } else {
        Serial.print("✗ Transmission failed. Code: ");
        Serial.println(responseCode);
        return false;
    }
}

// =============================================================================
// Web Server Handler Functions
// =============================================================================

void handleRoot() {
    String html = "<!DOCTYPE html><html><head>";
    html += "<title>DHT Sensor Monitor</title>";
    html += "<style>";
    html += "body { font-family: Arial, sans-serif; margin: 40px; }";
    html += ".container { max-width: 800px; margin: 0 auto; }";
    html += ".card { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #007cba; }";
    html += ".form-group { margin: 15px 0; }";
    html += "label { display: block; margin-bottom: 5px; font-weight: bold; }";
    html += "input[type=\"number\"], input[type=\"text\"], input[type=\"password\"] { width: 100%; max-width: 300px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }";
    html += "button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px; }";
    html += "button:hover { background: #005a87; }";
    html += ".nav { margin: 20px 0; }";
    html += ".nav a { display: inline-block; margin-right: 15px; padding: 10px 15px; background: #007cba; color: white; text-decoration: none; border-radius: 4px; }";
    html += ".nav a:hover { background: #005a87; }";
    html += ".status { padding: 10px; background: #e7f3ff; border-radius: 4px; margin: 10px 0; }";
    html += ".tab { overflow: hidden; border: 1px solid #ccc; background-color: #f1f1f1; border-radius: 4px 4px 0 0; }";
    html += ".tab button { background-color: inherit; float: left; border: none; outline: none; cursor: pointer; padding: 14px 16px; transition: 0.3s; }";
    html += ".tab button:hover { background-color: #ddd; }";
    html += ".tab button.active { background-color: #007cba; color: white; }";
    html += ".tabcontent { display: none; padding: 20px; border: 1px solid #ccc; border-top: none; border-radius: 0 0 4px 4px; }";
    html += ".message { padding: 10px; margin: 10px 0; border-radius: 4px; }";
    html += ".success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }";
    html += ".error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }";
    html += "</style>";
    html += "<script>";
    html += "function openTab(evt, tabName) {";
    html += "  var i, tabcontent, tabbuttons;";
    html += "  tabcontent = document.getElementsByClassName('tabcontent');";
    html += "  for (i = 0; i < tabcontent.length; i++) {";
    html += "    tabcontent[i].style.display = 'none';";
    html += "  }";
    html += "  tabbuttons = document.getElementsByClassName('tabbutton');";
    html += "  for (i = 0; i < tabbuttons.length; i++) {";
    html += "    tabbuttons[i].className = tabbuttons[i].className.replace(' active', '');";
    html += "  }";
    html += "  document.getElementById(tabName).style.display = 'block';";
    html += "  evt.currentTarget.className += ' active';";
    html += "}";
    html += "function showMessage(message, type) {";
    html += "  const msgDiv = document.getElementById('message');";
    html += "  msgDiv.innerHTML = message;";
    html += "  msgDiv.className = 'message ' + type;";
    html += "  msgDiv.style.display = 'block';";
    html += "}";
    html += "</script>";
    html += "</head><body>";
    html += "<div class=\"container\">";
    html += "<h1>DHT Sensor Monitor</h1>";
    html += "<div class=\"nav\">";
    html += "<a href=\"/\">Home</a>";
    html += "<a href=\"/health\">System Health</a>";
    html += "<a href=\"/sensor\">Sensor Data</a>";
    html += "<a href=\"/config\">Configuration</a>";
    html += "<a href=\"/push-now\">Force Reading</a>";
    html += "</div>";
    html += "<div id=\"message\" class=\"message\" style=\"display:none;\"></div>";
    html += "<div class=\"card\">";
    html += "<h2>Current Sensor Status</h2>";
    
    // Add current sensor readings
    SensorData data;
    if (readSensorData(data)) {
        html += "<div class='status'>";
        html += "<strong>Temperature:</strong> " + String(data.temperature) + "°C<br>";
        html += "<strong>Humidity:</strong> " + String(data.humidity) + "%";
        html += "</div>";
    } else {
        html += "<div class='status' style='background:#ffe7e7;'>Sensor read failed</div>";
    }
    
    html += "</div>";
    html += "<div class=\"card\">";
    html += "<h2>System Configuration</h2>";
    html += "<div class=\"tab\">";
    html += "<button class=\"tabbutton active\" onclick=\"openTab(event, 'Calibration')\">Calibration</button>";
    html += "<button class=\"tabbutton\" onclick=\"openTab(event, 'Thresholds')\">Thresholds</button>";
    html += "<button class=\"tabbutton\" onclick=\"openTab(event, 'Network')\">Network</button>";
    html += "</div>";
    html += "<div id=\"Calibration\" class=\"tabcontent\" style=\"display:block;\">";
    html += "<h3>Sensor Calibration</h3>";
    html += "<p>Enter the actual temperature and humidity values to calibrate the sensor.</p>";
    html += "<form method=\"POST\" action=\"/config\" onsubmit=\"event.preventDefault(); submitCalibration(this);\">";
    html += "<input type=\"hidden\" name=\"config_type\" value=\"calibration\">";
    html += "<div class=\"form-group\">";
    html += "<label for=\"actual_temperature\">Actual Temperature (°C):</label>";
    html += "<input type=\"number\" step=\"0.1\" id=\"actual_temperature\" name=\"actual_temperature\" required>";
    html += "</div>";
    html += "<div class=\"form-group\">";
    html += "<label for=\"actual_humidity\">Actual Humidity (%):</label>";
    html += "<input type=\"number\" step=\"0.1\" id=\"actual_humidity\" name=\"actual_humidity\" required>";
    html += "</div>";
    html += "<button type=\"submit\">Calibrate Sensor</button>";
    html += "</form>";
    html += "<div class=\"status\" style=\"margin-top: 20px;\">";
    html += "<h4>Current Calibration</h4>";
    html += "<p><strong>Temperature Offset:</strong> " + String(calibration.temperatureOffset) + "°C</p>";
    html += "<p><strong>Humidity Offset:</strong> " + String(calibration.humidityOffset) + "%</p>";
    html += "</div>";
    html += "</div>";
    html += "<div id=\"Thresholds\" class=\"tabcontent\">";
    html += "<h3>Alert Threshold Configuration</h3>";
    html += "<p>Set the temperature and humidity thresholds for LED alerts.</p>";
    html += "<form method=\"POST\" action=\"/config\" onsubmit=\"event.preventDefault(); submitThresholds(this);\">";
    html += "<input type=\"hidden\" name=\"config_type\" value=\"thresholds\">";
    html += "<div class=\"form-group\">";
    html += "<label for=\"temp_low\">Low Temperature Threshold (°C):</label>";
    html += "<input type=\"number\" step=\"0.1\" id=\"temp_low\" name=\"temp_low\" value=\"" + String(thresholds.tempLow) + "\" required>";
    html += "</div>";
    html += "<div class=\"form-group\">";
    html += "<label for=\"temp_high\">High Temperature Threshold (°C):</label>";
    html += "<input type=\"number\" step=\"0.1\" id=\"temp_high\" name=\"temp_high\" value=\"" + String(thresholds.tempHigh) + "\" required>";
    html += "</div>";
    html += "<div class=\"form-group\">";
    html += "<label for=\"humidity_low\">Low Humidity Threshold (%):</label>";
    html += "<input type=\"number\" step=\"0.1\" id=\"humidity_low\" name=\"humidity_low\" value=\"" + String(thresholds.humidityLow) + "\" required>";
    html += "</div>";
    html += "<div class=\"form-group\">";
    html += "<label for=\"humidity_high\">High Humidity Threshold (%):</label>";
    html += "<input type=\"number\" step=\"0.1\" id=\"humidity_high\" name=\"humidity_high\" value=\"" + String(thresholds.humidityHigh) + "\" required>";
    html += "</div>";
    html += "<button type=\"submit\">Save Thresholds</button>";
    html += "</form>";
    html += "<div class=\"status\" style=\"margin-top: 20px;\">";
    html += "<h4>Current Threshold Behavior</h4>";
    html += "<ul>";
    html += "<li><strong>Below low thresholds:</strong> LED blinks</li>";
    html += "<li><strong>Above high thresholds:</strong> LED turns ON</li>";
    html += "<li><strong>Within normal range:</strong> LED remains OFF</li>";
    html += "</ul>";
    html += "</div>";
    html += "</div>";
    html += "<div id=\"Network\" class=\"tabcontent\">";
    html += "<h3>Network Configuration</h3>";
    html += "<p>Configure WiFi and server settings (requires device restart).</p>";
    html += "<div class=\"status\">";
    html += "<p><strong>Current WiFi SSID:</strong> " + networkConfig.ssid + "</p>";
    html += "<p><strong>Current Server URL:</strong> " + networkConfig.serverUrl + "</p>";
    html += "<p><em>Note: Network configuration changes require device restart to take effect.</em></p>";
    html += "</div>";
    html += "</div>";
    html += "</div>";
    html += "<script>";
    html += "function submitCalibration(form) {";
    html += "  const formData = new FormData(form);";
    html += "  fetch('/config', {";
    html += "    method: 'POST',";
    html += "    body: formData";
    html += "  })";
    html += "  .then(response => response.text())";
    html += "  .then(data => {";
    html += "    showMessage('Calibration completed successfully!', 'success');";
    html += "    setTimeout(() => location.reload(), 2000);";
    html += "  })";
    html += "  .catch(error => {";
    html += "    showMessage('Calibration failed: ' + error, 'error');";
    html += "  });";
    html += "}";
    html += "function submitThresholds(form) {";
    html += "  const formData = new FormData(form);";
    html += "  fetch('/config', {";
    html += "    method: 'POST',";
    html += "    body: formData";
    html += "  })";
    html += "  .then(response => response.text())";
    html += "  .then(data => {";
    html += "    showMessage('Thresholds updated successfully!', 'success');";
    html += "    setTimeout(() => location.reload(), 2000);";
    html += "  })";
    html += "  .catch(error => {";
    html += "    showMessage('Threshold update failed: ' + error, 'error');";
    html += "  });";
    html += "}";
    html += "</script>";
    html += "</div></body></html>";
    
    webServer.send(200, "text/html", html);
}

void handleHealth() {
    String status = isWiFiConnected() ? "Connected" : "Disconnected";
    String html = "<html><body>";
    html += "<h1>System Health</h1>";
    html += "<p><strong>WiFi:</strong> " + status + "</p>";
    html += "<p><strong>IP:</strong> " + WiFi.localIP().toString() + "</p>";
    html += "<p><strong>Uptime:</strong> " + String(millis() / 1000) + "s</p>";
    html += "<p><strong>Sensor Reading:</strong> " + String(isReadingData ? "Active" : "Inactive") + "</p>";
    html += "<p><strong>WiFi SSID:</strong> " + networkConfig.ssid + "</p>";
    html += "<p><strong>Server URL:</strong> " + networkConfig.serverUrl + "</p>";
    html += "<p><strong>Temperature Thresholds:</strong> " + String(thresholds.tempLow) + "°C to " + String(thresholds.tempHigh) + "°C</p>";
    html += "<p><strong>Humidity Thresholds:</strong> " + String(thresholds.humidityLow) + "% to " + String(thresholds.humidityHigh) + "%</p>";
    html += "</body></html>";
    
    webServer.send(200, "text/html", html);
}

void handleSensorData() {
    SensorData data;
    if (readSensorData(data)) {
        String json = createJSONPayload(data);
        String base64 = encryptData(json);

        // Add 'X-Encrypted' header
        webServer.sendHeader("X-Encrypted", "true");

        webServer.send(200, "application/json", base64);
    } else {
        webServer.send(500, "application/json", "{\"error\":\"Sensor read failed\"}");
    }
}


void handleConfig() {
    if (webServer.method() == HTTP_GET) {
        handleRoot(); // Redirect to main page with configuration tabs
    }
    else if (webServer.method() == HTTP_POST) {
        String configType = webServer.arg("config_type");
        
        if (configType == "calibration") {
            // Handle calibration form submission
            String actualTempStr = webServer.arg("actual_temperature");
            String actualHumidityStr = webServer.arg("actual_humidity");
            
            if (actualTempStr.length() == 0 || actualHumidityStr.length() == 0) {
                webServer.send(400, "text/plain", "Error: Missing required fields");
                return;
            }
            
            float actualTemp = actualTempStr.toFloat();
            float actualHumidity = actualHumidityStr.toFloat();
            
            Serial.println("📡 Received calibration request via web form");
            Serial.printf("  Actual Temperature: %.1f°C\n", actualTemp);
            Serial.printf("  Actual Humidity: %.1f%%\n", actualHumidity);
            
            if (performCalibration(actualTemp, actualHumidity)) {
                webServer.send(200, "text/plain", "Calibration completed successfully");
            } else {
                webServer.send(500, "text/plain", "Calibration failed - could not read sensor data");
            }
        }
        else if (configType == "thresholds") {
            // Handle thresholds form submission
            String tempLowStr = webServer.arg("temp_low");
            String tempHighStr = webServer.arg("temp_high");
            String humidityLowStr = webServer.arg("humidity_low");
            String humidityHighStr = webServer.arg("humidity_high");
            
            // Validate and convert values
            float tempLow = tempLowStr.toFloat();
            float tempHigh = tempHighStr.toFloat();
            float humidityLow = humidityLowStr.toFloat();
            float humidityHigh = humidityHighStr.toFloat();
            
            // Basic validation
            if (tempLow >= tempHigh) {
                webServer.send(400, "text/plain", "Error: Low temperature threshold must be less than high threshold");
                return;
            }
            
            if (humidityLow >= humidityHigh) {
                webServer.send(400, "text/plain", "Error: Low humidity threshold must be less than high threshold");
                return;
            }
            
            // Update thresholds
            thresholds.tempLow = tempLow;
            thresholds.tempHigh = tempHigh;
            thresholds.humidityLow = humidityLow;
            thresholds.humidityHigh = humidityHigh;
            
            Serial.println("✓ Thresholds updated via web interface:");
            Serial.printf("  Temperature: %.1f°C to %.1f°C\n", thresholds.tempLow, thresholds.tempHigh);
            Serial.printf("  Humidity: %.1f%% to %.1f%%\n", thresholds.humidityLow, thresholds.humidityHigh);
            
            webServer.send(200, "text/plain", "Thresholds updated successfully");
        }
        else {
            webServer.send(400, "text/plain", "Error: Unknown configuration type");
        }
    }
    else {
        webServer.send(405, "text/plain", "Method Not Allowed");
    }
}

void handlePushNow() {
    SensorData data;
    if (readSensorData(data)) {
        displaySensorData(data);
        updateLEDBasedOnData(data);
        transmitSensorData(data);
        webServer.send(200, "text/plain", "Data pushed successfully");
    } else {
        webServer.send(500, "text/plain", "Sensor read failed");
    }
}

void initializeWebServer() {
    webServer.on("/", handleRoot);
    webServer.on("/health", handleHealth);
    webServer.on("/sensor", handleSensorData);
    webServer.on("/config", handleConfig);
    webServer.on("/push-now", handlePushNow);
    webServer.begin();
    Serial.println("✓ Web server started on port 80");
}

// =============================================================================
// Serial Command Processing Functions
// =============================================================================

void clearSerialBuffer() {
    while (Serial.available() > 0) {
        Serial.read();
    }
}

float readSerialFloat(const String& prompt) {
    Serial.println(prompt);
    while (!Serial.available()) {
        delay(100);
    }
    String input = Serial.readStringUntil('\n');
    input.trim();
    return input.toFloat();
}

void processCalibration() {
    Serial.println("\n=== SENSOR CALIBRATION ===");
    clearSerialBuffer();
    
    float actualTemp = readSerialFloat("Enter actual temperature (°C):");
    float actualHumidity = readSerialFloat("Enter actual humidity (%):");
    
    performCalibration(actualTemp, actualHumidity);
}

void processThresholdConfiguration() {
    Serial.println("\n=== THRESHOLD CONFIGURATION ===");
    clearSerialBuffer();
    
    thresholds.tempLow = readSerialFloat("Enter low temperature threshold (°C):");
    thresholds.tempHigh = readSerialFloat("Enter high temperature threshold (°C):");
    thresholds.humidityLow = readSerialFloat("Enter low humidity threshold (%):");
    thresholds.humidityHigh = readSerialFloat("Enter high humidity threshold (%):");
    
    Serial.println("✓ Thresholds updated:");
    Serial.printf("  Temperature: %.1f°C to %.1f°C\n", thresholds.tempLow, thresholds.tempHigh);
    Serial.printf("  Humidity: %.1f%% to %.1f%%\n", thresholds.humidityLow, thresholds.humidityHigh);
}

void processSerialCommand(char command) {
    switch (command) {
        case 'G': // Start continuous reading
            isReadingData = true;
            Serial.println("✓ START: Continuous reading enabled");
            break;
            
        case 'S': // Stop continuous reading
            isReadingData = false;
            setLED(false);
            Serial.println("✓ STOP: Continuous reading disabled");
            break;
            
        case 'C': // Calibrate sensors
            isReadingData = false;
            setLED(false);
            processCalibration();
            break;
            
        case 'T': // Configure thresholds
            isReadingData = false;
            setLED(false);
            processThresholdConfiguration();
            break;
            
        case 'R': // Reconfigure network
            isReadingData = false;
            setLED(false);
            Serial.println("=== NETWORK RECONFIGURATION ===");
            if (promptForConfiguration()) {
                connectToWiFi();
            }
            break;
            
        default:
            // Ignore unrecognized commands
            break;
    }
}

void checkSerialCommands() {
    if (Serial.available()) {
        char command = Serial.read();
        processSerialCommand(command);
    }
}

// =============================================================================
// Main Application Functions
// =============================================================================

void processSensorReading() {
    unsigned long currentTime = millis();
    if (currentTime - lastSensorReadTime < SENSOR_READ_INTERVAL_MS) {
        return;
    }
    
    SensorData data;
    if (readSensorData(data)) {
        displaySensorData(data);
        updateLEDBasedOnData(data);
        transmitSensorData(data);
        lastSensorReadTime = currentTime;
    }
}

void initializeSystem() {
    // Wait for serial connection
    waitForSerialConnection();
    
    // Initialize hardware
    initializeHardware();
    
    // Get network configuration from user
    bool configSuccess = false;
    while (!configSuccess) {
        configSuccess = promptForConfiguration();
    }
    
    // Connect to WiFi
    if (!connectToWiFi()) {
        Serial.println("⚠️  Starting in offline mode - WiFi connection failed");
    }
    
    // Start web server
    initializeWebServer();
    
    Serial.println("\n✓ System initialized successfully");
    Serial.println("Available Commands: G(Start), S(Stop), C(Calibrate), T(Thresholds), R(Reconfigure Network)");
    if (isWiFiConnected()) {
        Serial.println("Web Interface: http://" + WiFi.localIP().toString());
    }
}

// =============================================================================
// Arduino Main Functions
// =============================================================================

void setup() {
    initializeSystem();
}

void loop() {
    // Handle serial commands
    checkSerialCommands();
    
    // Handle web server requests
    webServer.handleClient();
    
    // Process sensor readings if enabled
    if (isReadingData) {
        processSensorReading();
    }
}