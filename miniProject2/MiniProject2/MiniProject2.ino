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
const unsigned long CONFIG_TIMEOUT_MS = 30000; // 30 seconds for configuration

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

struct ConfigRequest {
    float actual_temperature;
    float actual_humidity;
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
    Serial.println("(You have 30 seconds for each prompt)");
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
    delay(1000); // Give time for serial to initialize
    
    unsigned long startTime = millis();
    Serial.println("Waiting for serial connection...");
    
    // Wait for serial connection or timeout
    while (millis() - startTime < 5000) {
        if (Serial) {
            break;
        }
        delay(100);
    }
    
    if (!Serial) {
        Serial.begin(SERIAL_BAUD_RATE);
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
    String html = R"(
        <html>
            <body>
                <h1>DHT Sensor Monitor</h1>
                <ul>
                    <li><a href="/health">System Health</a></li>
                    <li><a href="/sensor">Sensor Data</a></li>
                    <li><a href="/config">Calibration Status</a></li>
                    <li><a href="/push-now">Force Reading</a></li>
                </ul>
                <h2>Calibration API</h2>
                <p>POST JSON to /config with:</p>
                <pre>
{
    "actual_temperature": 25.0,
    "actual_humidity": 50.0
}
                </pre>
                <h2>Network Configuration</h2>
                <p><strong>WiFi SSID:</strong> )" + networkConfig.ssid + R"(</p>
                <p><strong>Server URL:</strong> )" + networkConfig.serverUrl + R"(</p>
            </body>
        </html>
    )";
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
    html += "</body></html>";
    
    webServer.send(200, "text/html", html);
}

void handleSensorData() {
    SensorData data;
    if (readSensorData(data)) {
        String json = createJSONPayload(data);
        webServer.send(200, "application/json", json);
    } else {
        webServer.send(500, "application/json", "{\"error\":\"Sensor read failed\"}");
    }
}

void handleConfig() {
    if (webServer.method() == HTTP_GET) {
        // Return current calibration status
        String json = createCalibrationJSONPayload();
        webServer.send(200, "application/json", json);
    }
    else if (webServer.method() == HTTP_POST) {
        // Handle calibration via JSON
        String contentType = webServer.header("Content-Type");
        
        if (contentType != "application/json") {
            webServer.send(400, "application/json", 
                "{\"error\":\"Content-Type must be application/json\"}");
            return;
        }
        
        String postBody = webServer.arg("plain");
        
        // Parse JSON
        StaticJsonDocument<200> doc;
        DeserializationError error = deserializeJson(doc, postBody);
        
        if (error) {
            webServer.send(400, "application/json", 
                "{\"error\":\"Invalid JSON: " + String(error.c_str()) + "\"}");
            return;
        }
        
        // Validate required fields
        if (!doc.containsKey("actual_temperature") || !doc.containsKey("actual_humidity")) {
            webServer.send(400, "application/json", 
                "{\"error\":\"Missing required fields: actual_temperature and actual_humidity\"}");
            return;
        }
        
        float actualTemp = doc["actual_temperature"];
        float actualHumidity = doc["actual_humidity"];
        
        // Validate numeric values
        if (isnan(actualTemp) || isnan(actualHumidity)) {
            webServer.send(400, "application/json", 
                "{\"error\":\"Invalid numeric values provided\"}");
            return;
        }
        
        Serial.println("📡 Received calibration request via REST API");
        Serial.printf("  Actual Temperature: %.1f°C\n", actualTemp);
        Serial.printf("  Actual Humidity: %.1f%%\n", actualHumidity);
        
        // Perform calibration
        if (performCalibration(actualTemp, actualHumidity)) {
            // Return success response with new calibration data
            StaticJsonDocument<300> responseDoc;
            responseDoc["status"] = "success";
            responseDoc["message"] = "Calibration completed successfully";
            responseDoc["calibration"]["temperature_offset"] = calibration.temperatureOffset;
            responseDoc["calibration"]["humidity_offset"] = calibration.humidityOffset;
            
            String responseJson;
            serializeJson(responseDoc, responseJson);
            webServer.send(200, "application/json", responseJson);
        } else {
            webServer.send(500, "application/json", 
                "{\"error\":\"Calibration failed - could not read sensor data\"}");
        }
    }
    else {
        webServer.send(405, "application/json", 
            "{\"error\":\"Method not allowed. Use GET or POST\"}");
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