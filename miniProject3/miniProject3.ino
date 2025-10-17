// =============================================================================
// DHT Sensor Monitoring System for ESP32
// =============================================================================
// Features: Temperature/Humidity monitoring, BLE transmission, Battery Service
// =============================================================================

#include <DHT.h>
#include <ArduinoJson.h>
#include "mbedtls/aes.h"
#include "Base64.h"
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// =============================================================================
// Configuration
// =============================================================================
#define DHTPIN 4
#define DHTTYPE DHT11
#define LED_PIN 2
#define SENSOR_READ_INTERVAL_MS 2000

DHT dht(DHTPIN, DHTTYPE);

bool isReadingData = false;
unsigned long lastSensorReadTime = 0;

// =============================================================================
// Data Structures
// =============================================================================
struct SensorData {
    float temperature;
    float humidity;
    unsigned long timestamp;
};

struct Thresholds {
    float tempLow = 0.0;
    float tempHigh = 50.0;
    float humidityLow = 20.0;
    float humidityHigh = 80.0;
};

Thresholds thresholds;

// =============================================================================
// BLE Configuration
// =============================================================================
BLEServer* pServer = nullptr;
BLECharacteristic *pTempCharacteristic = nullptr;
BLECharacteristic *pHumidCharacteristic = nullptr;

BLECharacteristic *pBatteryCharacteristic = nullptr;   // New battery characteristic
uint8_t batteryLevel = 100;                            // Battery starts full
unsigned long lastBatteryUpdate = 0;                   // Timer for battery drain

bool deviceConnected = false;

#define SERVICE_UUID "181A"
#define TEMPERATURE_UUID "2A6E"
#define HUMIDITY_UUID "2A6F"
#define BATTERY_SERVICE_UUID "180F"
#define BATTERY_LEVEL_UUID "2A19"

// =============================================================================
// Utility Functions
// =============================================================================
void setLED(bool state) {
    digitalWrite(LED_PIN, state ? HIGH : LOW);
}

void clearSerialBuffer() {
    while (Serial.available()) Serial.read();
}

float readSerialFloat(const char* prompt) {
    Serial.print(prompt);
    while (!Serial.available()) delay(10);
    return Serial.parseFloat();
}

// =============================================================================
// Sensor Functions
// =============================================================================
bool readSensorData(SensorData& data) {
    float temp = dht.readTemperature();
    float hum = dht.readHumidity();

    if (isnan(temp) || isnan(hum)) {
        Serial.println("⚠️ Sensor read failed");
        return false;
    }

    data.temperature = temp;
    data.humidity = hum;
    data.timestamp = millis();
    return true;
}

void displaySensorData(const SensorData& data) {
    Serial.printf("🌡️  Temp: %.2f°C | 💧 Hum: %.2f%% | ⏱ %lu ms\n",
                  data.temperature, data.humidity, data.timestamp);
}

void updateLEDBasedOnData(const SensorData& data) {
    bool alert = (data.temperature < thresholds.tempLow || data.temperature > thresholds.tempHigh ||
                  data.humidity < thresholds.humidityLow || data.humidity > thresholds.humidityHigh);
    setLED(alert);
}

void transmitSensorData(const SensorData& data) {
    if (!deviceConnected) return;

    char tempStr[16];
    char humStr[16];

    snprintf(tempStr, sizeof(tempStr), "%.2f", data.temperature);
    snprintf(humStr, sizeof(humStr), "%.2f", data.humidity);

    if (pTempCharacteristic != nullptr) {
        pTempCharacteristic->setValue(tempStr);
        pTempCharacteristic->notify();
    }

    if (pHumidCharacteristic != nullptr) {
        pHumidCharacteristic->setValue(humStr);
        pHumidCharacteristic->notify();
    }

    Serial.printf("📡 BLE Sent → Temp: %.2f°C | Humidity: %.2f%%\n",
                  data.temperature, data.humidity);
}

// =============================================================================
// Calibration and Threshold Configuration
// =============================================================================
void processCalibration() {
    Serial.println("=== SENSOR CALIBRATION ===");
    Serial.println("Hold sensors steady...");
    delay(2000);
    Serial.println("✓ Calibration complete");
}

void processThresholdConfiguration() {
    Serial.println("\n=== THRESHOLD CONFIGURATION ===");
    clearSerialBuffer();
    
    thresholds.tempLow = readSerialFloat("Enter low temperature threshold (°C): ");
    thresholds.tempHigh = readSerialFloat("Enter high temperature threshold (°C): ");
    thresholds.humidityLow = readSerialFloat("Enter low humidity threshold (%): ");
    thresholds.humidityHigh = readSerialFloat("Enter high humidity threshold (%): ");
    
    Serial.println("✓ Thresholds updated:");
    Serial.printf("  Temperature: %.1f°C to %.1f°C\n", thresholds.tempLow, thresholds.tempHigh);
    Serial.printf("  Humidity: %.1f%% to %.1f%%\n", thresholds.humidityLow, thresholds.humidityHigh);
}

// =============================================================================
// Serial Command Processing
// =============================================================================
void processSerialCommand(char command) {
    switch (command) {
        case 'G':
            isReadingData = true;
            Serial.println("✓ START: Continuous reading enabled");
            break;
        case 'S':
            isReadingData = false;
            setLED(false);
            Serial.println("✓ STOP: Continuous reading disabled");
            break;
        case 'C':
            isReadingData = false;
            setLED(false);
            processCalibration();
            break;
        case 'T':
            isReadingData = false;
            setLED(false);
            processThresholdConfiguration();
            break;
        default:
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
// BLE Initialization
// =============================================================================
void startAdvertise(){
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->addServiceUUID(BATTERY_SERVICE_UUID); // 🔹 Added Battery Service UUID
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  BLEDevice::startAdvertising();
  Serial.println("Waiting for client connection to notify...");
}

class ServerCallbacks: public BLEServerCallbacks{
  void onConnect(BLEServer *pServer){
    deviceConnected = true;
    Serial.println("Device connected!");
  }

  void onDisconnect(BLEServer *pServer){
    deviceConnected = false;
    Serial.println("Device disconnected!");
    startAdvertise();
  }
};

void updateBatteryLevel() {
    unsigned long currentMillis = millis();

    // Drain 1% per minute
    if (currentMillis - lastBatteryUpdate >= 60000) {
        lastBatteryUpdate = currentMillis;

        if (batteryLevel > 0) batteryLevel--;
        else batteryLevel = 100;  // Reset when empty

        if (pBatteryCharacteristic != nullptr && deviceConnected) {
            pBatteryCharacteristic->setValue(&batteryLevel, 1);
            pBatteryCharacteristic->notify();
        }

        Serial.printf("🔋 Battery Level: %d%%\n", batteryLevel);
    }
}

void initializeBLE() {
    String bleDeviceName = "Team 2";
    BLEDevice::init(bleDeviceName.c_str());

    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new ServerCallbacks());

    // Environmental Sensing Service
    BLEService *pService = pServer->createService(SERVICE_UUID);

    pTempCharacteristic = pService->createCharacteristic(
        TEMPERATURE_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    pTempCharacteristic->addDescriptor(new BLE2902());

    pHumidCharacteristic = pService->createCharacteristic(
        HUMIDITY_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    pHumidCharacteristic->addDescriptor(new BLE2902());

    pService->start();

    // Create Battery Service
    BLEService *pBatteryService = pServer->createService(BATTERY_SERVICE_UUID);

    pBatteryCharacteristic = pBatteryService->createCharacteristic(
        BATTERY_LEVEL_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    pBatteryCharacteristic->addDescriptor(new BLE2902());
    pBatteryCharacteristic->setValue(&batteryLevel, 1);
    pBatteryService->start();

    // Advertising setup
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->addServiceUUID(BATTERY_SERVICE_UUID); // 🔹 Added
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();

    Serial.println("✅ BLE started successfully");
    Serial.println("📡 Services: 0x181A (Env Sensing), 0x180F (Battery)");
    Serial.println("📡 Characteristics: 0x2A6E (Temp), 0x2A6F (Humid), 0x2A19 (Battery)");
}

// =============================================================================
// Main Application Functions
// =============================================================================
void processSensorReading() {
    unsigned long currentTime = millis();
    if (currentTime - lastSensorReadTime < SENSOR_READ_INTERVAL_MS) return;
    
    SensorData data;
    if (readSensorData(data)) {
        displaySensorData(data);
        updateLEDBasedOnData(data);
        transmitSensorData(data);
        lastSensorReadTime = currentTime;
    }
}

void waitForSerialConnection() {
    Serial.begin(115200);
    delay(2000);
    unsigned long startTime = millis();
    Serial.println("Waiting for serial connection...");
    while (millis() - startTime < 10000) {
        if (Serial) break;
        delay(100);
    }
    while (Serial.available() > 0) Serial.read();
}

void initializeHardware() {
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
    dht.begin();
}

void initializeSystem() {
    waitForSerialConnection();
    initializeHardware();
    Serial.println("\n=== ESP32 DHT Sensor Monitor (BLE Only) ===");
    initializeBLE();
    Serial.println("\nAvailable Commands:");
    Serial.println("G - Start Reading");
    Serial.println("S - Stop Reading");
    Serial.println("C - Calibrate Sensors");
    Serial.println("T - Set Thresholds");
}

// =============================================================================
// Arduino Main Functions
// =============================================================================
void setup() {
    initializeSystem();
}

void loop() {
    checkSerialCommands();
    if (isReadingData) processSensorReading();
    updateBatteryLevel();
}