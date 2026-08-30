#pragma once
#include "sensor_reading.h"

namespace BleService {
    void begin();
    bool isConnected();
    void notifyReading(const SensorReading &reading);
}