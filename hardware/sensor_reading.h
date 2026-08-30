#pragma once
#include <stdint.h>

struct SensorReading {
    // BME280
    float temperature_c   = 0.0f;
    float humidity_pct    = 0.0f;
    float pressure_hpa    = 0.0f;

    // GY-30 
    float illuminance_lux = 0.0f;

    // MPU6050
    float tilt_angle_deg       = 0.0f;
    float vibration_magnitude  = 0.0f;

    // SW-420
    bool shock_detected = false;
    bool all_sensors_ok = true;
};
