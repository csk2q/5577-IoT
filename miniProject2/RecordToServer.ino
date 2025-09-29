#include <DHT.h>
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>

#include "Secrets.h"

#define LED_PIN 2
#define DHTPIN 4
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);
bool LedState = false;

const String LogApiURL = "http://192.168.1.195:2456/log";
ulong logCounter = 0;
ulong lastLogTime = 0;
const ulong logIntervalMs = 15000; // In milliseconds

HTTPClient http;

WebServer server(80);

void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200);
    while (!Serial) {
    ; // wait for serial port to connect. Needed for native USB port only
  }

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);


  // Set the ESP32 as access point
  // Serial.print("Setting as access point ");
  // WiFi.mode(WIFI_AP);
  // WiFi.softAP(ssid, password);
  // Serial.println("");
  // Serial.println("ESP32 Wi-Fi Access Point ready!");
  // IPAddress IP = WiFi.softAPIP();
  // Serial.print("AP IP address: ");
  // Serial.println(IP);
  
  WiFi.begin(SSID, WIFIPASS);
  Serial.print("Connecting to WIFI");
  while( !WiFi.isConnected() ) {
    Serial.print(".");
    delay(500);
  }
  Serial.println("\nSuccessfully connected to WIFI.");

  Serial.println("Syncing time...");
  configTime(9 * 60 * 60, 0, "ntp.jst.mfeed.ad.jp", "ntp.nict.jp", "time.google.com");

  // Seup routes on the web server
  server.on("/", handleRoot);
  server.on("/LED/on", []() { setLed(HIGH); });
  server.on("/LED/off", []() { setLed(LOW); });

  // Start the web server
  server.begin();
  Serial.println("HTTP server started");  

  // Start DHT library
  Serial.println("DHT driver started");  
  dht.begin();
}

void loop() {
  // put your main code here, to run repeatedly:

  // Handle incoming client requests
  server.handleClient();

  ulong now = millis();
  if (now - lastLogTime >= logIntervalMs) {
    lastLogTime = now;
    PostLog(ReadTemp());
  }

}

void setLed(byte state)
{
  bool LedState = state == HIGH;
  digitalWrite(LED_PIN, state);

  handleRoot();
}

// Function to handle the root URL and show the current states
void handleRoot() {
  String html = "<!DOCTYPE html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">";
  html += "<link rel=\"icon\" href=\"data:,\">";
  html += "<style>html { font-family: Helvetica; display: inline-block; margin: 0px auto; text-align: center;}";
  html += ".button { background-color: #4CAF50; border: none; color: white; padding: 16px 40px; text-decoration: none; font-size: 30px; margin: 2px; cursor: pointer;}";
  html += ".button2 { background-color: #555555; }</style></head>";
  html += "<body><h1>ESP32 Web Server</h1>";

  // Display LED controls
  if (LedState) {
    html += "<p>LED - State ON</p>";
    html += "<p><a href=\"/LED/off\"><button class=\"button button2\">OFF</button></a></p>";
  } else {
    html += "<p>LED - State OFF</p>";
    html += "<p><a href=\"/LED/on\"><button class=\"button\">ON</button></a></p>";
  }

  // Display GPIO 26 controls
  // html += "<p>GPIO 26 - State " + output26State + "</p>";
  // if (output26State == "off") {
  //   html += "<p><a href=\"/26/on\"><button class=\"button\">ON</button></a></p>";
  // } else {
  //   html += "<p><a href=\"/26/off\"><button class=\"button button2\">OFF</button></a></p>";
  // }

  // Display GPIO 27 controls
  // html += "<p>GPIO 27 - State " + output27State + "</p>";
  // if (output27State == "off") {
  //   html += "<p><a href=\"/27/on\"><button class=\"button\">ON</button></a></p>";
  // } else {
  //   html += "<p><a href=\"/27/off\"><button class=\"button button2\">OFF</button></a></p>";
  // }

  html += "</body></html>";
  server.send(200, "text/html", html);
}

String ReadTemp()
{
  ulong timeNow = millis();
  // TimeSinceStartup, logCounter, TempF, TempC, Humidity, HeatIndexF, HeatIndexC, Comment, 
  String report = "";
  report += String(timeNow) + ",";
  report += String(logCounter++) + ",";

  float humidity = dht.readHumidity();
  float tempCelsius = dht.readTemperature();
  float tempFahrenheit = dht.readTemperature(true);

  Serial.println("\nTime since startup: " + String(timeNow) + " Counter: " + String(logCounter));

  if (isnan(humidity) || isnan(tempCelsius) || isnan(tempFahrenheit)) {
    String failedMessage = "Failed to read from DHT sensor!";
    Serial.println(failedMessage);
    report += ",,,,,,," + failedMessage +",";
  }
  else
  {
    float HeatIndexF = dht.computeHeatIndex(tempFahrenheit, humidity, true);
    float HeatIndexC = dht.computeHeatIndex(tempCelsius, humidity);

    String message = "Tempature: " + String(tempFahrenheit) + "°F " + String(tempCelsius) + "°C"
    + "\nHumidity: " + String(humidity) + "%"
    + "\nHeat index: " + HeatIndexF + "°F " +  + "°C"
    + "\n";
    Serial.println(message);

    report += String(tempFahrenheit) + "°F,";
    report += String(tempCelsius) + "°C,";
    report += String(humidity) + "%,";
    report += String(HeatIndexF) + "°F,";
    report += String(tempCelsius) + "°C,";
    report += ","; // Blank Comment

  }

  return report;
}

void PostLog(String message)
{
  http.begin(LogApiURL);
  http.addHeader("Content-Type", "text/plain");
  // http.addHeader("Content-Type", "application/json");

  // String json = "{\"sensor\":\"temp\",\"value\":23.5}";
  int httpCode = http.POST(message); // send POST

  if (httpCode > 0) {
    Serial.printf("HTTP %d\n", httpCode);
    String payload = http.getString();
    Serial.println(payload);
  } else {
    Serial.printf("Request failed, error: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end(); // Explicitly close the connection.
}



