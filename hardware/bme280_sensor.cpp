#include "sensors.h"
#include <Adafruit_BME280.h>
#include <Wire.h>

namespace SensorBME280 {

namespace {
    Adafruit_BME280 bme;
    constexpr uint8_t I2C_ADDRESS = 0x76;
    bool isPhysicallyPlausible(float temperature_c, float humidity_pct, float pressure_hpa) {
        if (isnan(temperature_c) || isnan(humidity_pct) || isnan(pressure_hpa)) {
            return false;
        }
        if (temperature_c < -40.0f || temperature_c > 85.0f) return false;
        if (humidity_pct < 0.0f || humidity_pct > 100.0f) return false;
        if (pressure_hpa < 300.0f || pressure_hpa > 1100.0f) return false;
        return true;
    }
}

bool begin() {
    return bme.begin(I2C_ADDRESS);
}

bool read(SensorReading &out) {
    float temperature_c = bme.readTemperature();
    float humidity_pct = bme.readHumidity();
    float pressure_hpa = bme.readPressure() / 100.0f; 

    if (!isPhysicallyPlausible(temperature_c, humidity_pct, pressure_hpa)) {
        return false;
    }

    out.temperature_c = temperature_c;
    out.humidity_pct = humidity_pct;
    out.pressure_hpa = pressure_hpa;
    return true;
}

} 
