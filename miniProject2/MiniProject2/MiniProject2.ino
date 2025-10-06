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

// Network Configuration
const char* WIFI_SSID = "Pixel_1587";
const char* WIFI_PASSWORD = "ChaoticGood2025";
const char* SERVER_URL = "http://10.62.129.211:8888/post-data";

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

// =============================================================================
// Core Hardware Functions
// =============================================================================

void initializeHardware() {
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
    dhtSensor.begin();
    Serial.begin(SERIAL_BAUD_RATE);
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

void connectToWiFi() {
    Serial.print("Connecting to: ");
    Serial.println(WIFI_SSID);
    
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    
    Serial.println("\n✓ WiFi connected");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
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

bool transmitSensorData(const SensorData& data) {
    if (!isWiFiConnected()) {
        Serial.println("✗ WiFi not connected - cannot transmit data");
        return false;
    }
    
    HTTPClient http;
    http.begin(SERVER_URL);
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
                    <li><a href="/push-now">Force Reading</a></li>
                </ul>
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
    
    SensorData current;
    if (readSensorData(current)) {
        calibration.temperatureOffset = current.temperature - actualTemp;
        calibration.humidityOffset = current.humidity - actualHumidity;
        
        Serial.println("✓ Calibration complete:");
        Serial.printf("  Temp offset: %.2f°C\n", calibration.temperatureOffset);
        Serial.printf("  Humidity offset: %.2f%%\n", calibration.humidityOffset);
    } else {
        Serial.println("✗ Failed to read current sensor values");
    }
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
    Serial.println("\n=== " + String(DEVICE_NAME) + " ===");
    
    // Initialize hardware
    initializeHardware();
    
    // Connect to network
    connectToWiFi();
    
    // Start web server
    initializeWebServer();
    
    Serial.println("✓ System initialized successfully");
    Serial.println("Available Commands: G(Start), S(Stop), C(Calibrate), T(Thresholds)");
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