#pragma once
#include "sensor_reading.h"

namespace SensorBME280 {
    bool begin();
    bool read(SensorReading &out);
}

namespace SensorGY30 {
    bool begin();
    bool read(SensorReading &out);
}

namespace SensorMPU6050 {
    bool begin();
    bool read(SensorReading &out);
}

namespace SensorSW420 {
    void begin(uint8_t pin);
    void read(SensorReading &out);
}
