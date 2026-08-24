#include <Arduino.h>
#include <Wire.h>

#include "sensor_reading.h"
#include "sensors/sensors.h"
#include "ble/ble_service.h"

namespace {
    constexpr uint8_t SW420_PIN = 25;
    constexpr uint32_t MEASUREMENT_INTERVAL_MS = 2000;

    uint32_t lastMeasurementAt = 0;
    bool bme280Ready = false;
    bool gy30Ready = false;
    bool mpu6050Ready = false;

    void logInitResult(const char *sensorName, bool ok) {
        Serial.print(sensorName);
        Serial.println(ok ? ": OK" : ": FAILED (check wiring/I2C address)");
    }

    SensorReading takeMeasurement() {
        SensorReading reading{};
        bool allOk = true;

        if (!bme280Ready || !SensorBME280::read(reading)) {
            allOk = false;
        }
        if (!gy30Ready || !SensorGY30::read(reading)) {
            allOk = false;
        }
        if (!mpu6050Ready || !SensorMPU6050::read(reading)) {
            allOk = false;
        }
        SensorSW420::read(reading);

        reading.all_sensors_ok = allOk;
        return reading;
    }

    void printReading(const SensorReading &reading) {
        Serial.print("Temperature (C): "); Serial.println(reading.temperature_c);
        Serial.print("Humidity (%): ");     Serial.println(reading.humidity_pct);
        Serial.print("Pressure (hPa): ");   Serial.println(reading.pressure_hpa);
        Serial.print("Illuminance (lux): ");Serial.println(reading.illuminance_lux);
        Serial.print("Tilt angle (deg): "); Serial.println(reading.tilt_angle_deg);
        Serial.print("Vibration: ");        Serial.println(reading.vibration_magnitude);
        Serial.print("Shock detected: ");   Serial.println(reading.shock_detected ? "YES" : "no");
        Serial.print("All sensors OK: ");   Serial.println(reading.all_sensors_ok ? "yes" : "NO (partial reading)");
    }
}

void setup() {
    Serial.begin(115200);
    delay(1000);
    Wire.begin();

    bme280Ready = SensorBME280::begin();
    logInitResult("BME280", bme280Ready);

    gy30Ready = SensorGY30::begin();
    logInitResult("GY-30 (BH1750)", gy30Ready);

    mpu6050Ready = SensorMPU6050::begin();
    logInitResult("MPU6050", mpu6050Ready);

    SensorSW420::begin(SW420_PIN);
    Serial.println("SW-420: OK (digital pin, no init check)");

    BleService::begin();
    Serial.println("BLE advertising started as \"Wolis-SensorBox\"");

    if (!bme280Ready || !gy30Ready || !mpu6050Ready) {
        Serial.println(
            "WARNING: one or more I2C sensors failed to initialize. "
            "Measurements will be marked as partial until resolved."
        );
    }
}

void loop() {
    uint32_t now = millis();

    if (now - lastMeasurementAt >= MEASUREMENT_INTERVAL_MS) {
        lastMeasurementAt = now;

        SensorReading reading = takeMeasurement();
        printReading(reading);

        if (BleService::isConnected()) {
            BleService::notifyReading(reading);
        }
    }
}
