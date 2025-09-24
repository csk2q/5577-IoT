// This sketch was built on top of an example, in the public domain, from the DHT Sensor Library by ladyada.

#include "DHT.h"
#include <stdexcept>
#include <string>
#define LED_PIN 2
#define DHTPIN 4 // Digital pin connected to the DHT sensor

#define DHTTYPE DHT11   // DHT 11

using std::string;

// Constants
const unsigned long BaudRate = 115200;

// Initialize DHT sensor.
DHT dht(DHTPIN, DHTTYPE);
bool readData = false;
unsigned long lastSensorReadTime = 0;
unsigned long lastBlink = 0;

// Offsets
const float DefaultOffsetTemp = 0;
const float DefaultOffsetHumid = 0;
float offsetTemp = DefaultOffsetTemp;
float offsetHumid = DefaultOffsetHumid;

// Thresholds
const float defaultLowTempThreshC = 15;
const float defaultHighTempThreshC = 30;
const float defaultLowHumidThresh = 30;
const float defaultHighHumidThresh = 70;
float lowTempThreshC = defaultLowTempThreshC;
float highTempThreshC = defaultHighTempThreshC;
float lowHumidThresh = defaultLowHumidThresh;
float highHumidThresh = defaultHighHumidThresh;


// Helper Functions //

// Reads a line from the serial console
std::string serialReadLine(const char lineEnding = '\n')
{
  // Wait for serial to be available
  while (Serial.available() == 0);
  
  // Read line and trim
  String input = Serial.readStringUntil('\n');
  input.trim();
  // Serial.println(input); // Print input back to serial
  return input.c_str();
}


// Setup & Loop //

void setup() {
  // Start serial console
  Serial.begin(BaudRate);
  while (Serial.available() == 0); // Wait for serial to be available
  Serial.println("Hello serial console!");
  Serial.println("Commands: \n\
  G for Go        - Start reading from sensor \n\
  S for Stop      - Stop reading from sensor \n\
  C for Calibrate - Begin sensor calibration \n\
  T for Threshold - Set thresholds for LED behavior \n\
  R for Restart   - Soft restarts the ESP32");

  // Configure the LED pin
  pinMode(LED_PIN, OUTPUT);

  // Start communicating with the temperature sensor
  dht.begin();
}

void loop() {

  // Read single token from serial
  int r = Serial.read(); // -1 when nothing

  // Convert input letter to upper case.
  if (r != -1)
    r = std::toupper((char)r);

  switch ( r ) {
    case 'G':  readData = true;  Serial.println("START");                             break;  // G for Go
    case 'S':  readData = false; digitalWrite(LED_PIN, LOW); Serial.println("STOP");  break;  // S for Stop
    case 'C':  readData = false; digitalWrite(LED_PIN, LOW); calibrateData();         break;  // C for Calibrate
    case 'T':  readData = false; digitalWrite(LED_PIN, LOW); changeThresholds();      break;  // T for Threshold
    case 'R': readData = false;  Serial.println("Restarting!"); ESP.restart();        break;  // R for Restart
    default: break;  // ignore everything else
  }

  if(readData)
    readSensor();
}


// Command Functions //

// Reads and prints the temperature and humidity from the DHT11 sensor.
// Also updates the state of the LED based on the set thresholds.
void readSensor()
{
  // Exit early if less than a second has passed since the last run.
  if(millis() - lastSensorReadTime <= 1000)
    return;

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

  // Update last sensor read time
  lastSensorReadTime = millis();

  // Print sensor data
  Serial.print(F("Humidity: "));
  Serial.print(h - offsetHumid);
  Serial.print(F("%  Temperature: "));
  Serial.print(t - offsetTemp);
  Serial.println(F("°C "));
  Serial.print((f - offsetTemp));
  Serial.println(F("°F "));

  // By default...
  // If the temperature is below 15°C or humidity is below 30%, the LED should blink every second.
  if((t - offsetTemp) < lowTempThreshC || (h - offsetHumid) < lowHumidThresh) {
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  }
  // If the temperature exceeds 30°C or humidity exceeds 70%, the LED should turn on.
  else if((t - offsetTemp) > highTempThreshC || (h - offsetHumid) > highHumidThresh) {
    digitalWrite(LED_PIN, HIGH);
  }
  // For temperature between 15°C and 30°C and humidity between 30% and 70%, the LED should remain off.
  else {
    digitalWrite(LED_PIN, LOW);
  }
}


// Requests the user for the true temperature and humidity then calculates offsets.
void calibrateData(){

  // Reset default offset
  offsetTemp = DefaultOffsetTemp;
  offsetHumid = DefaultOffsetTemp;
  Serial.println("Removed previous offsets.");

  // Input variables
  float currTemp;
  float currHumid;

  //Clear the message line of anything that might be leftover from previous inputs
  while (Serial.available() > 0) {
    Serial.read();
  }

  try
  {
    // Get accurate data for current temp
    Serial.println("Please enter the current temperature in Celsius. This will be used to calculate the proper offset for the termperature sensor. ");
    string input = serialReadLine();
    currTemp = std::stof(input);

    // Get accurate data for current humidity
    Serial.println("Please enter the current humidity. This will be used to calculate the proper offset for the humidity sensor. ");
    input = serialReadLine();
    currHumid = std::stof(input);

    // Set offsets (after string->float conversions)
    offsetTemp = dht.readTemperature() - currTemp;
    offsetHumid = dht.readHumidity() - currHumid;
  }
  catch(const std::invalid_argument& e)
  {
    Serial.println("Failed to read input as decimal value.");
    return;
  }


  Serial.print("Offset Temp: ");
  Serial.println(offsetTemp);
  Serial.print("Offset Humidity: ");
  Serial.println(offsetHumid);
}

// Requests the user for high and low thresholds, which control the behavior of the LED.
void changeThresholds() {

  // Reset previous thresholds
  lowTempThreshC = defaultLowTempThreshC;
  highTempThreshC = defaultHighTempThreshC;
  lowHumidThresh = defaultLowHumidThresh;
  highHumidThresh = defaultHighHumidThresh;

  //Clear the message line of anything that might be leftover from previous inputs
  while (Serial.available() > 0) {
    Serial.read();
  }

  try
  {
    //Get data for temp threshold lower
    Serial.println("Please enter your new lower threshold for Temperature in Celsius ");
    float newLowerThreshC = std::stof(serialReadLine());

    //Get data for temp threshold upper
    Serial.println("Please enter your new upper threshold for Temperature in Celsius ");
    float newHighTempThreshC = std::stof(serialReadLine());

    //Get data for humidity threshold lower
    Serial.println("Please enter your new lower threshold for humidity");
    float newHumidLowThresh = std::stof(serialReadLine());

    //Get data for humidity threshold upper
    Serial.println("Please enter your new upper threshold for humidity ");
    float newHimidHighThresh = std::stof(serialReadLine());

    // Set thresholds (after string->float conversions)
    lowTempThreshC = newLowerThreshC;
    highTempThreshC = newHighTempThreshC;
    lowHumidThresh = newHumidLowThresh;
    highHumidThresh = newHimidHighThresh;
  }
  catch(const std::invalid_argument& e)
  {
    Serial.println("Failed to read input as decimal value. Threshold values reset to default.");
    return;
  }

  // Report new thresholds to Serial
  Serial.print("Temp Threshold: ");
  Serial.print(lowTempThreshC);
  Serial.print(" to ");
  Serial.println(highTempThreshC);

  Serial.print("Humidity Threshold: ");
  Serial.print(lowHumidThresh);
  Serial.print(" to ");
  Serial.println(highHumidThresh);
}
