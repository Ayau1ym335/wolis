#include "sensors.h"
#include <BH1750.h>
#include <Wire.h>

namespace SensorGY30 {

namespace {
    BH1750 lightMeter;
    bool isPhysicallyPlausible(float lux) {
        if (isnan(lux)) return false;
        return lux >= 0.0f && lux <= 65535.0f;
    }
}

bool begin() {
    return lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
}

bool read(SensorReading &out) {
    float lux = lightMeter.readLightLevel();

    if (!isPhysicallyPlausible(lux)) {
        return false;
    }

    out.illuminance_lux = lux;
    return true;
}

} 
