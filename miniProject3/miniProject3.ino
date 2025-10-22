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

// Include ESP-IDF GAP header for esp_ble_gap_read_rssi and GAP events
#include "esp_gap_ble_api.h"
#include "esp_bt.h"

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

BLECharacteristic *pTxPowerCharacteristic = nullptr; 
float esp32TxPowerLevel = 0;

BLECharacteristic *pDistanceCharacteristic = nullptr;
static unsigned long lastDistanceUpdate = 0;
static unsigned long lastDistanceRead = 0;
const unsigned long distanceUpdateInterval = 5000; // 5 seconds
const unsigned long distanceReadInterval = 500; // 0.5 seconds
bool distanceCalibrated = false;
float lastRssi = 9999999;
float measuredClientTxPower = 9999999;
float oneMeterRssi = 9999999;
float pathLossExponent = 3.5;
const float dClose = 0.02; // meters (approx distance when devices touch)


bool deviceConnected = false;
static esp_bd_addr_t deviceAddr; // 6-byte address
static bool haveAddress = false;

#define SERVICE_UUID "181A"
#define TEMPERATURE_UUID "2A6E"
#define HUMIDITY_UUID "2A6F"
#define BATTERY_SERVICE_UUID "180F"
#define BATTERY_LEVEL_UUID "2A19"
#define TX_POWER_SERVICE_UUID "1804"
#define TX_POWER_LEVEL_UUID "2A07"

#define DISTANCE_SERVICE_UUID "12345678-1234-5678-1234-56789abcdef0"
#define DISTANCE_UUID    "12345678-1234-5678-1234-56789abcdef1"

// Forward declare handler (must match typedef gap_event_handler)
void gapEventHandler(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param);

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
    // Clear console
    clearSerialBuffer();
    Serial.println("=== SENSOR CALIBRATION ===");
    Serial.println("Place device on ESP32 to record baseline transmit power.");
    Serial.println("Press ENTER when ready.");
    while (Serial.read() != '\n') {}
    // Serial.readStringUntil('\n');
    Serial.print("Takeing samples...");

    const int sampleCount = 10;
    float rssiSamples = 0;
    for (size_t i = 0; i < sampleCount; i++)
    {
        requestRssiRead();
        delay(500);
        if(lastRssi < 9999999)
            rssiSamples += lastRssi;
        else
            i--;
        Serial.print(".");
    }
    Serial.println();
    measuredClientTxPower = rssiSamples / sampleCount;

    Serial.println("Baseline TX measured to be: " + String(measuredClientTxPower) + " dbm");
    delay(100);
    Serial.println("Place device on 1 meter from ESP32.");
    Serial.println("Press ENTER when ready.");
    clearSerialBuffer();
    // Serial.flush();
    // clearSerialBuffer();
    // while(Serial.available() > 0) Serial.read();
    Serial.readStringUntil('\n');
    Serial.print("Takeing samples");

    rssiSamples = 0;
    for (size_t i = 0; i < sampleCount; i++)
    {
        requestRssiRead();
        delay(500);
        if(lastRssi < 9999999)
            rssiSamples += lastRssi;
        else
         i--;
        Serial.print(".");
    }
    oneMeterRssi = rssiSamples / sampleCount;
    Serial.println();
    Serial.println("One meter TX measured to be: " + String(oneMeterRssi) + " dbm");
    // Serial.println("Enter path-loss exponent (environment dependent; outside n≈2, indoors 3-4).");
    Serial.flush();
    pathLossExponent = readSerialFloat("Enter path-loss exponent (environment dependent; outside n≈2, indoors 3-4).");
    Serial.println("Path-loss exponent set to " + String(pathLossExponent));

    distanceCalibrated = true;
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
// BLE Initialization & Callbacks
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

  void onConnect(BLEServer *pServer, esp_ble_gatts_cb_param_t *param) override {
    if (param && param->connect.remote_bda) {
      memcpy(deviceAddr, param->connect.remote_bda, sizeof(deviceAddr));
      haveAddress = true;
    } else {
      haveAddress = false;
    }
    deviceConnected = true;

    // Print friendly MAC address
    char addrStr[18];
    sprintf(addrStr, "%02X:%02X:%02X:%02X:%02X:%02X",
            deviceAddr[0], deviceAddr[1], deviceAddr[2],
            deviceAddr[3], deviceAddr[4], deviceAddr[5]);
    Serial.printf("Client device connected! MAC: %s\n", addrStr);

    // Get the current TX‑power
    esp32TxPowerLevel = esp_ble_tx_power_get(ESP_BLE_PWR_TYPE_DEFAULT);
    pTxPowerCharacteristic->setValue(String(esp32TxPowerLevel) + " dbm");
    pTxPowerCharacteristic->notify();
  }

  void onDisconnect(BLEServer *pServer){
    deviceConnected = false;
    haveAddress = false;
    Serial.println("Client device disconnected!");
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

void requestRssiRead()
{
    // Request RSSI read for the connected peer.
    // The RSSI value will arrive asynchronously in gapEventHandler
    // esp_ble_gap_read_rssi expects esp_bd_addr_t (uint8_t[6])
    esp_err_t err = esp_ble_gap_read_rssi(deviceAddr);
    if (err != ESP_OK) {
        Serial.printf("esp_ble_gap_read_rssi() returned 0x%04X\n", err);
        return;
    }
}

void updateDistanceService(){
    if (deviceConnected && haveAddress) {
        unsigned long now = millis();

        if (now - lastDistanceRead >= distanceReadInterval) {
            lastDistanceRead = now;
            requestRssiRead();
        }

        if (now - lastDistanceUpdate >= distanceUpdateInterval) {
        lastDistanceUpdate = now;

        if (lastRssi < 9999999)
        {
            // Calculate estimated distance using path loss model
            float distanceEstimate = 0.0;
            if (distanceCalibrated)
            {
                float n = (oneMeterRssi - measuredClientTxPower) / (10.0 * log10(dClose));

                // Estimate distance for current RSSI reading
                distanceEstimate = pow(10.0, (oneMeterRssi - lastRssi) / (10.0 * n));
            }

            char distStr[64];
            snprintf(distStr, sizeof(distStr), "RSSI: %.1f dBm | distance≈%.2fm", lastRssi, distanceEstimate);

            pDistanceCharacteristic->setValue(distStr);
            pDistanceCharacteristic->notify();

            // Update Tx Power Level characteristic too
            // pTxPowerCharacteristic->setValue((int8_t)esp32TxPowerLevel);
            // pTxPowerCharacteristic->notify();

            // Serial.printf("📶 Distance update → %s\n", distStr);
        }
    }
  }
}

void initializeBLE() {
    String bleDeviceName = "Team 2";
    BLEDevice::init(bleDeviceName.c_str());

    // Register the GAP event callback to receive READ_RSSI_COMPLETE and other events
    esp_err_t rc = esp_ble_gap_register_callback(gapEventHandler);
    if (rc != ESP_OK) {
        Serial.printf("ERROR: esp_ble_gap_register_callback returned 0x%04X\n", rc);
    } else {
        // Serial.println("Registered GAP callback");
    }

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

    // Tx Power service
    BLEService *pTxPowerService = pServer->createService(TX_POWER_SERVICE_UUID);

    pTxPowerCharacteristic = pTxPowerService->createCharacteristic(
        TX_POWER_LEVEL_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    pTxPowerCharacteristic->addDescriptor(new BLE2902());
    pTxPowerCharacteristic->setValue("??? dbm");
    pTxPowerService->start();

    // Distance service
    BLEService *pBLEService = pServer->createService(DISTANCE_SERVICE_UUID);
    pDistanceCharacteristic = pBLEService->createCharacteristic(
        DISTANCE_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    pDistanceCharacteristic->addDescriptor(new BLE2902());
    pDistanceCharacteristic->setValue("???");
    pBLEService->start();

    // Advertising setup
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->addServiceUUID(BATTERY_SERVICE_UUID); // 🔹 Added
    pAdvertising->addServiceUUID(DISTANCE_SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();

    Serial.println("✅ BLE started successfully");
    Serial.println("📡 Services: 0x181A (Env Sensing), 0x180F (Battery)");
    Serial.println("📡 Characteristics: 0x2A6E (Temp), 0x2A6F (Humid), 0x2A19 (Battery)");
}

// GAP event handler - receives the READ_RSSI_COMPLETE event with RSSI data
void gapEventHandler(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param) {
  switch (event) {
    case ESP_GAP_BLE_READ_RSSI_COMPLETE_EVT: {
      // param->read_rssi_cmpl should be available; use a reference for clarity
      auto &rc = param->read_rssi_cmpl;
      if (rc.status == ESP_BT_STATUS_SUCCESS) {
        int rssi = rc.rssi; // measured RSSI in dBm
        uint8_t *bda = rc.remote_addr; // remote address
        char addrStr[18];
        sprintf(addrStr, "%02X:%02X:%02X:%02X:%02X:%02X",
                bda[0], bda[1], bda[2], bda[3], bda[4], bda[5]);
        // Serial.printf("GAP READ_RSSI_COMPLETE from %s -> RSSI: %d dBm\n", addrStr, rssi);

        if (pDistanceCharacteristic != nullptr && deviceConnected && haveAddress) {
            lastRssi = rssi;
        }

      } else {
        Serial.printf("GAP READ_RSSI_COMPLETE status error: 0x%02X\n", rc.status);
      }
      break;
    }

    case ESP_GAP_BLE_ADV_START_COMPLETE_EVT:
      if (param->adv_start_cmpl.status == ESP_BT_STATUS_SUCCESS) {
        Serial.println("Advertising started (GAP event).");
      }
      break;

    default:
      // you can debug other events here if desired
      break;
  }
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
    Serial.setTimeout(60000);
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
    updateDistanceService();
}