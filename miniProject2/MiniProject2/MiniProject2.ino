// Example testing sketch for various DHT humidity/temperature sensors written by ladyada
// REQUIRES the following Arduino libraries:
// - DHT Sensor Library: https://github.com/adafruit/DHT-sensor-library
// - Adafruit Unified Sensor Lib: https://github.com/adafruit/Adafruit_Sensor

#include <DHT.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "mbedtls/aes.h"   // ESP32 has built-in mbedTLS
#include "Base64.h"
#include <WebServer.h>


// Replace with your WiFi credentials
// const char* ssid = "CasieBroad";
// const char* password = "8162574964106";
const char* ssid = "Pixel_1587";
const char* password = "ChaoticGood2025";
// 16-byte key (AES-128)
const unsigned char aesKey[16] = { '1','2','3','4','5','6','7','8','9','0','a','b','c','d','e','f' };
const unsigned char aesIV[16]  = { 'a','b','c','d','e','f','1','2','3','4','5','6','7','8','9','0' };

// Flask server URL
const char* serverName = "http://10.10.141.68:8888/post-data";

WebServer server(80); 
// Variable to store the HTTP request
String header;

#define LED_PIN 2
#define DHTPIN 4     // Digital pin connected to the DHT sensor

#define DHTTYPE DHT11   // DHT 11

// Initialize DHT sensor.
DHT dht(DHTPIN, DHTTYPE);
bool readData = false;
unsigned long previousData = 0;

//Offsets
float offsetTemp = 0;
float offsetHumid = 0;

//Thresholds
float lowTempThreshC = 15;
float highTempThreshC = 30;
float lowHumidThresh = 30;
float highHumidThresh = 70;

void setup() {
  Serial.begin(115200);
  Serial.println(F("DHTxx test!"));
  pinMode(LED_PIN, OUTPUT);
  dht.begin();

  //Connecting to Wifi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.println("Waiting");
    Serial.print(" WiFi status: ");
    Serial.println(WiFi.status());
  }
  Serial.println("\nConnected!");
  Serial.println(WiFi.localIP());


  server.on("/", handleRoot);
  server.on("/health", handleHealth);
  server.on("/sensor", handleSensor);
  server.on("/config", handleConfig);
  server.on("/push-now", handlePushNow);

	server.begin(); 
}



void loop() {
  readSerial();
  readWeb();
}


void readSerial() {
  int r = Serial.read(); // -1 when nothing
  switch ( r ) {
    case 'G':  readData = true;  Serial.println("START");                             break;  // G for Go
    case 'S':  readData = false; digitalWrite(LED_PIN, LOW); Serial.println("STOP");  break;  // S for Stop
    case 'C':  readData = false; digitalWrite(LED_PIN, LOW); calibrateData();         break;  // C for Calibrate
    case 'T':  readData = false; digitalWrite(LED_PIN, LOW); changeThresholds();      break;  // T for Threshold
    default: break;  // ignore everything else
  }
  

  if(readData){
    readSensor();
  }
}

void readWeb(){
  server.handleClient();
}

void readSensor(){
    // Reading temperature or humidity takes about 250 milliseconds!
    // Sensor readings may also be up to 2 seconds 'old' (its a very slow sensor)
    float h = dht.readHumidity();
    // Read temperature as Celsius (the default)
    float t = dht.readTemperature();
    // Read temperature as Fahrenheit (isFahrenheit = true)
    float f = dht.readTemperature(true);


    if(millis() - previousData > 1000){
      // Check if any reads failed and exit early (to try again).
      if (isnan(h) || isnan(t) || isnan(f)) {
        Serial.println(F("Failed to read from DHT sensor!"));
        return;
      }

      previousData = millis();
      Serial.print(F("Humidity: "));
      Serial.print(h - offsetHumid);
      Serial.print(F("%  Temperature: "));
      Serial.print(t - offsetTemp);
      Serial.println(F("°C "));
      /*Serial.print((f - offsetTemp));
      Serial.println(F("°F "));*/

      checkWifi(t - offsetTemp, h - offsetHumid, millis());

      //If the temperature is below 15°C or humidity is below 30%, the LED should blink every second.
      if((t - offsetTemp) < lowTempThreshC || (h - offsetHumid) < lowHumidThresh){
        digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      //If the temperature exceeds 30°C or humidity exceeds 70%, the LED should turn on.
      } else if((t - offsetTemp) > highTempThreshC || (h - offsetHumid) > highHumidThresh){
        digitalWrite(LED_PIN, HIGH);
      //For temperature between 15°C and 30°C and humidity between 30% and 70%, the LED should remain off.
      } else {
        digitalWrite(LED_PIN, LOW);
      }
    }
}

void handleRoot(){
  Serial.print("Handle Root");
  server.send(200,"text/html","<html><body>Hello World</body></html>");
}

void handleHealth(){
  String healthStatus = "<html><body><p><strong>Sensor Status:&nbsp;</strong>";
  healthStatus += "Good";
  healthStatus += "</p></body></html>";

  server.send(200,"text/html", healthStatus);
}

void handleSensor(){
    float h = dht.readHumidity();
    float t = dht.readTemperature();

    String jsonData = "{";
    jsonData += "\"team_number\":2,";
    jsonData += "\"temperature\":" + String(t) + ",";
    jsonData += "\"humidity\":" + String(h) + ",";
    jsonData += "}";

    String encryptedData = encryptAES(jsonData);

    server.send(200,"text/json", jsonData);
}

void handleConfig(){

}

void handlePushNow(){
  readSensor();
}



void calibrateData(){
  //Reset previous offset
  offsetTemp = 0;
  offsetHumid = 0;

  //Clear the message line of anything that might be leftover from previous inputs
  while (Serial.available() > 0) {
    Serial.read();
  }

  //Get accurate data for current temp
  Serial.println("Please enter the current temperature in Celsius. This will be used to calculate the proper offset for the termperature sensor. ");
  while (Serial.available() == 0) {
    // do nothing, just wait
  }
  String input = Serial.readStringUntil('\n');
  input.trim();
  float currTemp = input.toFloat();

  //Get accurate data for current humidity
  Serial.println("Please enter the current humidity. This will be used to calculate the proper offset for the humidity sensor. ");

  while (Serial.available() == 0) {
    // do nothing, just wait
  }

  input = Serial.readStringUntil('\n');
  input.trim();
  float currHumid = input.toFloat();

  offsetTemp = dht.readTemperature() - currTemp;
  offsetHumid = dht.readHumidity() - currHumid;
  Serial.print("Offset Temp: ");
  Serial.println(offsetTemp);
  Serial.print("Offset Humidity: ");
  Serial.println(offsetHumid);
}


void changeThresholds(){
  //Reset previous thresholds
  lowTempThreshC = 15;
  highTempThreshC = 30;
  lowHumidThresh = 30;
  highHumidThresh = 70;

  //Clear the message line of anything that might be leftover from previous inputs
  while (Serial.available() > 0) {
    Serial.read();
  }

  //Get data for temp threshold lower
  Serial.println("Please enter your new lower threshold for Temperature in Celsius ");
  while (Serial.available() == 0) {
    // do nothing, just wait
  }
  String input = Serial.readStringUntil('\n');
  input.trim();
  lowTempThreshC = input.toFloat();

  //Get data for temp threshold upper
  Serial.println("Please enter your new upper threshold for Temperature in Celsius ");

  while (Serial.available() == 0) {
    // do nothing, just wait
  }

  input = Serial.readStringUntil('\n');
  input.trim();
  highTempThreshC = input.toFloat();

  //Get data for humidity threshold lower
  Serial.println("Please enter your new lower threshold for humidity");
  while (Serial.available() == 0) {
    // do nothing, just wait
  }
  input = Serial.readStringUntil('\n');
  input.trim();
  lowHumidThresh = input.toFloat();

  //Get data for humidity threshold upper
  Serial.println("Please enter your new upper threshold for humidity ");

  while (Serial.available() == 0) {
    // do nothing, just wait
  }

  input = Serial.readStringUntil('\n');
  input.trim();
  highHumidThresh = input.toFloat();

  Serial.print("Temp Threshold: ");
  Serial.print(lowTempThreshC);
  Serial.print(" to ");
  Serial.println(highTempThreshC);

  Serial.print("Humidity Threshold: ");
  Serial.print(lowHumidThresh);
  Serial.print(" to ");
  Serial.println(highHumidThresh);
}

void checkWifi(float temp, float humid, unsigned long time) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverName);

    http.addHeader("Content-Type", "text/plain");

    String jsonData = "{";
    jsonData += "\"team_number\":2,";
    jsonData += "\"temperature\":" + String(temp) + ",";
    jsonData += "\"humidity\":" + String(humid) + ",";
    jsonData += "\"timestamp\":" + String(time);  // number, no quotes
    jsonData += "}";


    String encryptedData = encryptAES(jsonData);
    int httpResponseCode = http.POST(encryptedData);

    if (httpResponseCode > 0) {
      Serial.println("Server response: " + http.getString());
    } else {
      Serial.print("Error code: ");
      Serial.println(httpResponseCode);
    }

    http.end();
  } else {
    Serial.println("WiFi disconnected");
  }
}

String encryptAES(String plainText) {
  int len = plainText.length();
  int paddedLen = ((len + 15) / 16) * 16;
  unsigned char input[paddedLen];
  unsigned char output[paddedLen];
  memset(input, 0, paddedLen);
  memcpy(input, plainText.c_str(), len);

  mbedtls_aes_context aes;
  mbedtls_aes_init(&aes);
  mbedtls_aes_setkey_enc(&aes, aesKey, 128);

  unsigned char iv_copy[16];
  memcpy(iv_copy, aesIV, 16);

  mbedtls_aes_crypt_cbc(&aes, MBEDTLS_AES_ENCRYPT, paddedLen, iv_copy, input, output);
  mbedtls_aes_free(&aes);

  return base64::encode(output, paddedLen);
}