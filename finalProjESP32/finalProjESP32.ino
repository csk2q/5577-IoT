#include "esp32-hal.h"
#include <ArduinoJson.h>
#include <WiFi.h>
#include <time.h>
#include <Preferences.h>
#include <esp32-hal-gpio.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
// #include <string.h>

const int ledPin    = 2;
const int pressurePin = 32; // Analog pressure sensor pin
String backendHost;
String sensor_id;
const int buzzerPin = 18;
const int inputPin  = 34;

const unsigned long sendIntervalMillseconds = 10000; // 10 seconds
unsigned long lastSend = 0;

bool lastButtonState = false;
bool buzzerOn = false;
bool ledOn = false;

WiFiServer server(80);
Preferences prefs;

void clearSerialBuffer() {
    while (Serial.available() > 0) {
        Serial.read();
    }
    Serial.flush();
}

// Helper to read a line from the Serial console
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

// Attempt to connect to WiFi with a timeout. Returns true if connected.
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

// Sync ESP32 time with an NTP server
void syncTime()
{
  // Time zone string – e.g. "PST8PDT" or "EST5EDT" (optional)
  // If you don’t need DST handling, you can just set it to "GMT0".
  const char* tzinfo = "CST6CDT";

  // NTP server list
  const char* ntpServer1 = "pool.ntp.org";
  const char* ntpServer2 = "time.nist.gov";

  // Set timezone
  configTzTime(tzinfo, ntpServer1, ntpServer2);

  // Wait until the time is valid
  time_t now = 0;
  const int maxRetries = 30;      // 30 * 1s = 30s timeout
  for (int i = 0; i < maxRetries; ++i)
  {
    now = time(nullptr);
    if (now > 0) break;          // Got a valid time
    delay(1000);
  }

  if (now == 0)
  {
    Serial.println("NTP sync failed!");
  }
  else
  {
    Serial.print("Central‑Time now: ");
    Serial.println(ctime(&now)); // Human‑readable format
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

void setup() {
  pinMode(ledPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  pinMode(inputPin, INPUT);

  Serial.begin(115200);
  while (!Serial) { delay(10); } // Wait for serial connection
  delay(1000);
  readLineFromSerial();
  clearSerialBuffer();
  Serial.println("ESP32 starting...");

  bool configConfirmed = false;
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

    connectWiFi(ssid, password);
    configConfirmed = true;
  }

    syncTime(); // Get time data from the internet

  server.begin();
  Serial.println("HTTP server started");
}

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

void loop() {
  if (server.hasClient()) {
    WiFiClient client = server.available();
    if (client) {
      processClient(client);
      client.stop();
    }
  }

  // Handle button press: trigger alert and manage buzzer/LED
  bool buttonPressed = digitalRead(inputPin) == LOW;
  if (buttonPressed) {
    buzzerOn = true;
    ledOn = true;
    lastButtonState = true;
    // Trigger alert to backend
    sendAlert();
  }


  if (lastButtonState && !buttonPressed) {
    buzzerOn = false;
    ledOn = false;
    lastButtonState = false;
  }

  // Periodically send sensor data to backend
  if (millis() - lastSend > sendIntervalMillseconds) {
    sendSensorData();
    lastSend = millis();
  }

  // Set LED based on ledOn state
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

void sendSensorData() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Not connected to WiFi. Cannot send sensor data.");
    return;
  }
  int pressureRaw = analogRead(pressurePin);
  StaticJsonDocument<256> doc;
  doc["sensor_id"] = sensor_id;
  doc["pressure"] = pressureRaw;
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
  // doc["timestamp"] = String(millis()); // millis() is time since ESP32 startup
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
