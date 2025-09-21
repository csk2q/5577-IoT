// This sketch built ontop of an simple example in the public domain from the DHT Sensor Library by ladyada.

#include "DHT.h"
#define LED_PIN 2
#define DHTPIN 4 // Digital pin connected to the DHT sensor

#define DHTTYPE DHT11   // DHT 11

// Initialize DHT sensor.
DHT dht(DHTPIN, DHTTYPE);
bool readData = false;
unsigned long lastSensorReadTime = 0;
unsigned long lastBlink = 0;

// Offsets
// TODO: Add default offsets for our sensor? Or make it a command?
float offsetTemp = 0;
float offsetHumid = 0;

// Thresholds
float lowTempThreshC = 15;
float highTempThreshC = 30;
float lowHumidThresh = 30;
float highHumidThresh = 70;

void setup() {
  // Start serial console
  Serial.begin(115200);
  Serial.println("Hello serial console!");

  // Configure the LED pin
  pinMode(LED_PIN, OUTPUT);

  // Start communicating with the tempature sensor
  dht.begin();
}

void loop() {

  int r = Serial.read(); // -1 when nothing
  switch ( r ) {
    case 'G':  readData = true;  Serial.println("START");                             break;  // G for Go
    case 'S':  readData = false; digitalWrite(LED_PIN, LOW); Serial.println("STOP");  break;  // S for Stop
    case 'C':  readData = false; digitalWrite(LED_PIN, LOW); calibrateData();         break;  // C for Calibrate
    case 'T':  readData = false; digitalWrite(LED_PIN, LOW); changeThresholds();      break;  // T for Threshold
    default: break;  // ignore everything else
  }

  if(readData && millis() - lastSensorReadTime > 1000){

    // Reading temperature or humidity takes about 250 milliseconds!
    // Sensor readings may also be up to 2 seconds 'old' (its a very slow sensor)
    float h = dht.readHumidity();
    // Read temperature as Celsius (the default)
    float t = dht.readTemperature();
    // Read temperature as Fahrenheit (isFahrenheit = true)
    float f = dht.readTemperature(true);
    /*// Compute heat index in Fahrenheit (the default)
    float hif = dht.computeHeatIndex(f, h);
    // Compute heat index in Celsius (isFahreheit = false)
    float hic = dht.computeHeatIndex(t, h, false);*/


    // Check if any reads failed and exit early (to try again).
    if (isnan(h) || isnan(t) || isnan(f)) {
      Serial.println(F("Failed to read from DHT sensor!"));
      return;
    }

    lastSensorReadTime = millis();

    Serial.print(F("Humidity: "));
    Serial.print(h - offsetHumid);
    Serial.print(F("%  Temperature: "));
    Serial.print(t - offsetTemp);
    Serial.println(F("°C "));
    /*Serial.print((f - offsetTemp));
    Serial.println(F("°F "));*/

    // By default...
    // If the temperature is below 15°C or humidity is below 30%, the LED should blink every second.
    if((t - offsetTemp) < lowTempThreshC || (h - offsetHumid) < lowHumidThresh){
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    // If the temperature exceeds 30°C or humidity exceeds 70%, the LED should turn on.
    } else if((t - offsetTemp) > highTempThreshC || (h - offsetHumid) > highHumidThresh){
      digitalWrite(LED_PIN, HIGH);
    // For temperature between 15°C and 30°C and humidity between 30% and 70%, the LED should remain off.
    } else {
      digitalWrite(LED_PIN, LOW);
    }
  }
}

void calibrateData(){
  //Reset previous offset
  float currTemp;
  float currHumid;

  try
  {
    //Clear the message line of anything that might be leftover from previous inputs
    while (Serial.available() > 0) {
      Serial.read();
    }

    //Get accurate data for current temp
    Serial.println("Please enter the current temperature in Celsius. This will be used to calculate the proper offset for the termperature sensor. ");
    while (Serial.available() == 0) {
      // do nothing, wait for input
    }
    String input = Serial.readStringUntil('\n');
    input.trim();
    currTemp = input.toFloat();

    //Get accurate data for current humidity
    Serial.println("Please enter the current humidity. This will be used to calculate the proper offset for the humidity sensor. ");

    while (Serial.available() == 0) {
      // do nothing, wait for input
    }

    input = Serial.readStringUntil('\n');
    input.trim();
    currHumid = input.toFloat();

  }
  catch(const std::exception& e)
  {
    Serial.println("Failed to read input. Please enter a decimal value.");
    return; // Do not update offsets
  }

  offsetTemp = 0;
  offsetHumid = 0;

  offsetTemp = dht.readTemperature() - currTemp;
  offsetHumid = dht.readHumidity() - currHumid;
  Serial.print("Offset Temp: ");
  Serial.println(offsetTemp);
  Serial.print("Offset Humidity: ");
  Serial.println(offsetHumid);
}


void changeThresholds(){
  // TODO add error checking.

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