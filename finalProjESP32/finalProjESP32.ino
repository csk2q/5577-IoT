#include "esp32-hal.h"
#include <ArduinoJson.h>
#include <WiFi.h>
#include <time.h>
#include <Preferences.h>
#include <esp32-hal-gpio.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <Wire.h>            // I²C bus
#include "MAX30105.h"        // MAX30105 driver
#include "spo2_algorithm.h"  // SpO₂ / HR algorithm

/* ----- Global mock mode flag ----- */
bool mockMode = false;

/* ----- Pin and constant definitions ----- */
const int ledPin      = 2;
const int buzzerPin   = 18;
const int inputPin    = 34;
const int pressurePin = 32;   // Analog pressure sensor pin

/* ----- Networking ----- */
String backendHost;   // e.g. "http://example.com"
String sensor_id;    // e.g. "ESP32-001"

/* ----- Timing ----- */
const unsigned long sendIntervalMillseconds = 10000; // 10 s
unsigned long lastSend = 0;

/* ----- State variables ----- */
bool lastButtonState = false;
bool buzzerOn = false;
bool ledOn    = false;

/* ----- Server ----- */
WiFiServer server(80);
Preferences prefs;

/* ----- MAX30105 ----- */
MAX30105 particleSensor;

#define MAX_BRIGHTNESS 255

uint32_t irBuffer[100];   //infrared LED sensor data
uint32_t redBuffer[100];  //red LED sensor data

int32_t bufferLength = 100;  // buffer length of 100 stores 4 seconds of samples at 25 sps
int32_t spo2;            // SPO₂ value
int8_t validSPO2;        // indicator to show if the SPO₂ calculation is valid
int32_t heartRate;       // heart rate value
int8_t validHeartRate;   // indicator to show if the heart rate calculation is valid
float temperatureC;
float temperatureF;

/* ----- Utility functions ----- */
void clearSerialBuffer() {
  while (Serial.available() > 0) {
    Serial.read();
  }
  Serial.flush();
}

String readLineFromSerial() {
  String line = "";
  while (true) {
    if (Serial.available()) {
      char c = Serial.read();
      if (c == '\n') {
        break;
      } else if (c != '\r') {
        line += c;
      }
    }
  }
  line.trim();
  return line;
}

void sendResponse(WiFiClient &client, const char* body) {
  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: text/plain");
  client.print("Content-Length: ");
  client.println(strlen(body));
  client.println();
  client.println(body);
}

bool connectWiFi(const String &ssid, const String &password) {
  WiFi.begin(ssid.c_str(), password.c_str());
  Serial.print("Connecting to WiFi ");
  Serial.println(ssid);
  const unsigned long startTime = millis();
  const unsigned long timeoutMs = 15000; // 15 seconds
  while (WiFi.status() != WL_CONNECTED && (millis() - startTime) < timeoutMs) {
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    return true;
  }
  Serial.println("\nWiFi connection failed.");
  return false;
}

void syncTime()
{
  const char* tzinfo = "CST6CDT";
  const char* ntpServer1 = "pool.ntp.org";
  const char* ntpServer2 = "time.nist.gov";

  configTzTime(tzinfo, ntpServer1, ntpServer2);

  time_t now = 0;
  const int maxRetries = 30;      // 30 * 1s = 30s timeout
  for (int i = 0; i < maxRetries; ++i)
  {
    now = time(nullptr);
    if (now > 0) break;
    delay(1000);
  }

  if (now == 0)
  {
    Serial.println("NTP sync failed!");
  }
  else
  {
    Serial.print("Central‑Time now: ");
    Serial.println(ctime(&now));
  }
}

String getTimestamp()
{
  time_t nowSec = time(nullptr);
  struct tm timeinfo;
  gmtime_r(&nowSec, &timeinfo);
  char buffer[30];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buffer);
}

/* ----- MAX30105 helper functions ----- */
void readHRSpO2() {
  if (mockMode) {
    // Generate mock heart rate and SpO₂ values
    heartRate = random(60, 100);
    spo2 = random(95, 100);
    validHeartRate = 1;
    validSPO2 = 1;
    return;
  }

  // Original algorithm logic
  for (byte i = 25; i < bufferLength; i++) {
    redBuffer[i - 25] = redBuffer[i];
    irBuffer[i - 25] = irBuffer[i];
  }

  for (byte i = 75; i < bufferLength; i++) {
    while (!particleSensor.available())
      particleSensor.check();

    redBuffer[i] = particleSensor.getRed();
    irBuffer[i] = particleSensor.getIR();
    particleSensor.nextSample(); //We're finished with this sample so move to next sample

    // send samples and calculation result to terminal program through UART
    // Serial.print(F("red="));
    // Serial.print(redBuffer[i], DEC);
    // Serial.print(F(", ir="));
    // Serial.print(irBuffer[i], DEC);

    // Serial.print(F(", HR="));
    // Serial.print(heartRate, DEC);

    // Serial.print(F(", HRvalid="));
    // Serial.print(validHeartRate, DEC);

    // Serial.print(F(", SPO2="));
    // Serial.print(spo2, DEC);

    // Serial.print(F(", SPO2Valid="));
    // Serial.println(validSPO2, DEC);
  }

  //After gathering 25 new samples recalculate HR and SP02
  maxim_heart_rate_and_oxygen_saturation(irBuffer, bufferLength, redBuffer, &spo2, &validSPO2, &heartRate, &validHeartRate);
}

void readTemperature()
{
  if (mockMode) {
    temperatureC = random(361, 380) / 10.0; // 36.1 – 38.0 °C
    temperatureF = temperatureC * 9 / 5 + 32;
    return;
  }
  temperatureC = particleSensor.readTemperature();
  temperatureF = particleSensor.readTemperatureF();
}

/* ----- HTTP request handling ----- */
void processClient(WiFiClient &client) {
  String request = client.readStringUntil('\r');
  client.read(); // skip '\n'
  if (request.startsWith("GET")) {
    int firstSpace = request.indexOf(' ');
    int secondSpace = request.indexOf(' ', firstSpace + 1);
    String path = request.substring(firstSpace + 1, secondSpace);
    if (path == "/led/on") {
      ledOn = true;
      sendResponse(client, "LED ON");
    } else if (path == "/led/off") {
      ledOn = false;
      sendResponse(client, "LED OFF");
    } else if (path == "/buzzer/on") {
      buzzerOn = true;
      sendResponse(client, "Buzzer ON");
    } else if (path == "/buzzer/off") {
      buzzerOn = false;
      sendResponse(client, "Buzzer OFF");
    } else {
      sendResponse(client, "Not Found");
    }
  } else {
    sendResponse(client, "Unsupported");
  }
}

/* ----- Sensor data/alert sending ----- */
void sendSensorData() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Not connected to WiFi. Cannot send sensor data.");
    return;
  }

  int pressure = analogRead(pressurePin);

  StaticJsonDocument<512> doc;
  doc["sensor_id"]        = sensor_id;
  doc["timestamp"]       = getTimestamp();
  doc["pressure"]         = (pressure != 4095);
  doc["temperature"]     = temperatureC;
  doc["heart_rate"]      = heartRate;
  doc["heart_rate_valid"]= validHeartRate;
  doc["oxygen_level"]    = spo2;
  doc["spo2_valid"]      = validSPO2;

  String json;
  serializeJson(doc, json);

  HTTPClient http;
  String url = backendHost + "/api/v1/sensors/data";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  int httpCode = http.POST(json);

  if (httpCode > 0) {
    String payload = http.getString();
    Serial.println("Sensor data sent. Response:");
    Serial.println(payload);
  } else {
    Serial.print("Failed to send sensor data. Error: ");
    Serial.println(http.errorToString(httpCode).c_str());
  }
  http.end();
}

void sendAlert() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Not connected to WiFi. Cannot send alert.");
    return;
  }
  StaticJsonDocument<256> doc;
  doc["sensor_id"] = sensor_id;
  doc["alert_type"] = "button_pressed";
  doc["timestamp"] = getTimestamp();

  String json;
  serializeJson(doc, json);

  HTTPClient http;
  String url = backendHost + "/api/v1/sensors/alert";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  int httpCode = http.POST(json);

  if (httpCode > 0) {
    String payload = http.getString();
    Serial.println("Alert sent. Response:");
    Serial.println(payload);
  } else {
    Serial.print("Failed to send alert. Error: ");
    Serial.println(http.errorToString(httpCode).c_str());
  }
  http.end();
}

/* ----- Arduino setup ----- */
void setup() {
  pinMode(ledPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  pinMode(inputPin, INPUT);
  pinMode(pressurePin, INPUT);

  Serial.begin(115200);
  while (!Serial) { delay(10); }
  delay(1000);
  readLineFromSerial();
  clearSerialBuffer();
  Serial.println("ESP32 starting...");

  /* Attempt to initialise the sensor – fallback to mock mode if not found */
  bool sensorFound = false;
  for (int attempt = 0; attempt < 3; ++attempt) {
    if (particleSensor.begin(Wire, I2C_SPEED_FAST)) {
      sensorFound = true;
      break;
    } else {
      Serial.println(F("MAX30105 was not found. Please check wiring/power."));
      delay(5000);
    }
  }
  if (!sensorFound) {
    mockMode = true;
    Serial.println(F("MAX30105 not found after attempts. Switching to mock mode."));
  }

  /* Load or ask for Wi‑Fi configuration */
  bool configConfirmed = false;
  prefs.begin("config", false);
  bool hasConfig = prefs.isKey("backendHost") && prefs.isKey("sensor_id") &&
                   prefs.isKey("ssid") && prefs.isKey("password");

  if (hasConfig) {
    String storedBackendHost = prefs.getString("backendHost");
    String storedSensorId   = prefs.getString("sensor_id");
    String storedSsid       = prefs.getString("ssid");
    String storedPassword   = prefs.getString("password");

    Serial.println("Saved configuration found:");
    Serial.print("Backend Host: "); Serial.println(storedBackendHost);
    Serial.print("Sensor ID: "); Serial.println(storedSensorId);
    Serial.print("SSID: "); Serial.println(storedSsid);
    Serial.print("Password: "); Serial.println("******");

    Serial.println("Use this configuration? (Y/N)");
    while (!Serial.available()) delay(100);
    char useSaved = toupper(Serial.read());
    if (useSaved == 'Y') {
      backendHost = storedBackendHost;
      sensor_id   = storedSensorId;
      String ssid = storedSsid;
      String password = storedPassword;
      connectWiFi(ssid, password);
      configConfirmed = true;
    }
  }

  while (!configConfirmed) {
    clearSerialBuffer();

    Serial.println("Enter backend host URL (e.g., http://example.com):");
    backendHost = readLineFromSerial();
    Serial.println("Enter sensor ID (e.g., ESP32-001):");
    sensor_id = readLineFromSerial();

    Serial.println("Enter SSID:");
    String ssid = readLineFromSerial();
    Serial.println("Enter password:");
    String password = readLineFromSerial();

    Serial.println("Summary of entered values:");
    Serial.print("Backend Host: "); Serial.println(backendHost);
    Serial.print("Sensor ID: "); Serial.println(sensor_id);
    Serial.print("SSID: "); Serial.println(ssid);
    Serial.print("Password: "); Serial.println("******");

    Serial.println("Confirm? (Y/N)");
    while (!Serial.available()) delay(100);
    char confirm = toupper(Serial.read());
    if (confirm != 'Y') {
      Serial.println("Re-enter configuration.");
      continue;
    }

    prefs.begin("config", true);
    prefs.putString("backendHost", backendHost);
    prefs.putString("sensor_id", sensor_id);
    prefs.putString("ssid", ssid);
    prefs.putString("password", password);
    prefs.end();

    connectWiFi(ssid, password);
    configConfirmed = true;
  }

  syncTime();

  /* Sensor specific setup – only if real sensor is present */
  if (!mockMode) {
    particleSensor.enableDIETEMPRDY();  // Enable temp ready interrupt

    Serial.println(F("Attach sensor to finger with rubber band. Press any key to start conversion"));

    byte ledBrightness = 32;   // Options: 0=Off to 255=50 mA
    byte sampleAverage = 8;    // Options: 1, 2, 4, 8, 16, 32
    byte ledMode = 2;          // 1=Red only, 2=Red+IR, 3=Red+IR+Green
    byte sampleRate = 400;     // Options: 50, 100, 200, 400, 800, 1000, 1600, 3200
    int pulseWidth = 411;      // Options: 69, 118, 215, 411
    int adcRange = 4096;       // Options: 2048, 4096, 8192, 16384

    particleSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
  }

  /* Preload buffer – only if real sensor is present */
  if (!mockMode) {
    Serial.println("Preloading sensor data into buffer");
    for (byte i = 0; i < bufferLength; i++) {
      while (!particleSensor.available())
        particleSensor.check();

      redBuffer[i] = particleSensor.getRed();
      irBuffer[i] = particleSensor.getIR();
      particleSensor.nextSample();

      Serial.print(F("red="));
      Serial.print(redBuffer[i], DEC);
      Serial.print(F(", ir="));
      Serial.println(irBuffer[i], DEC);
    }
  }

  server.begin();
  Serial.println("HTTP server started");
}

/* ----- Arduino loop ----- */
unsigned long lastBloodRead = 0;

void loop() {
  /* Handle HTTP clients */
  if (server.hasClient()) {
    WiFiClient client = server.available();
    if (client) {
      processClient(client);
      client.stop();
    }
  }

  /* Periodic sensor read (every second) */
  if (millis() - lastBloodRead > 1000) {
    lastBloodRead = millis();
    readHRSpO2();
    readTemperature();

    Serial.print("SpO2: ");
    Serial.print(spo2);
    Serial.print(", valid: ");
    Serial.println(validSPO2);

    Serial.print("Heart Rate: ");
    Serial.print(heartRate);
    Serial.print(", valid: ");
    Serial.println(validHeartRate);

    Serial.print("temperatureC=");
    Serial.print(temperatureC, 4);
    Serial.print(" temperatureF=");
    Serial.println(temperatureF, 4);

    Serial.print("Pressure=");
    Serial.println(analogRead(pressurePin));
  }

  /* Button handling – trigger alert and control buzzer/LED */
  bool buttonPressed = digitalRead(inputPin) == HIGH;
  if (buttonPressed) {
    buzzerOn = true;
    ledOn = true;
    lastButtonState = true;
    sendAlert();
  }

  if (lastButtonState && !buttonPressed) {
    buzzerOn = false;
    ledOn = false;
    lastButtonState = false;
  }

  /* Periodic sensor data upload */
  if (millis() - lastSend > sendIntervalMillseconds) {
    sendSensorData();
    lastSend = millis();
  }

  /* LED & buzzer output */
  digitalWrite(ledPin, ledOn ? HIGH : LOW);

  if (buzzerOn) {
    for (int i = 0; i < 24; i++) {
      digitalWrite(buzzerPin, HIGH);
      delay(1);
      digitalWrite(buzzerPin, LOW);
      delay(1);
    }
    for (int i = 0; i < 30; i++) {
      digitalWrite(buzzerPin, HIGH);
      digitalWrite(buzzerPin, LOW);
      delay(2);
    }
  } else {
    digitalWrite(buzzerPin, LOW);
  }
}