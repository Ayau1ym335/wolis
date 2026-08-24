#include "sensors.h"
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>
#include <math.h>

namespace SensorMPU6050 {
namespace {
    Adafruit_MPU6050 mpu;
    constexpr int VIBRATION_WINDOW = 10;
    constexpr uint16_t SAMPLE_INTERVAL_MS = 5;
    constexpr float GRAVITY = 9.80665f;

    float computeTiltAngleDeg(float ax, float ay, float az) {
        float horizontalMagnitude = sqrtf(ax * ax + ay * ay);
        float angleRad = atan2f(horizontalMagnitude, az);
        return angleRad * 180.0f / PI;
    }
    bool readAveraged(float &tiltAngleDeg, float &vibrationMagnitude) {
        float sumAx = 0, sumAy = 0, sumAz = 0;
        float magnitudes[VIBRATION_WINDOW];

        for (int i = 0; i < VIBRATION_WINDOW; i++) {
            sensors_event_t accel, gyro, temp;
            if (!mpu.getEvent(&accel, &gyro, &temp)) {
                return false;
            }

            sumAx += accel.acceleration.x;
            sumAy += accel.acceleration.y;
            sumAz += accel.acceleration.z;
            magnitudes[i] = sqrtf(
                accel.acceleration.x * accel.acceleration.x +
                accel.acceleration.y * accel.acceleration.y +
                accel.acceleration.z * accel.acceleration.z
            );

            delay(SAMPLE_INTERVAL_MS);
        }

        float avgAx = sumAx / VIBRATION_WINDOW;
        float avgAy = sumAy / VIBRATION_WINDOW;
        float avgAz = sumAz / VIBRATION_WINDOW;
        tiltAngleDeg = computeTiltAngleDeg(avgAx, avgAy, avgAz);

        float meanMagnitude = 0;
        for (int i = 0; i < VIBRATION_WINDOW; i++) meanMagnitude += magnitudes[i];
        meanMagnitude /= VIBRATION_WINDOW;

        float variance = 0;
        for (int i = 0; i < VIBRATION_WINDOW; i++) {
            float diff = magnitudes[i] - meanMagnitude;
            variance += diff * diff;
        }
        variance /= VIBRATION_WINDOW;
        vibrationMagnitude = sqrtf(variance);
        return true;
    }

    bool isPhysicallyPlausible(float tiltAngleDeg, float vibrationMagnitude) {
        if (isnan(tiltAngleDeg) || isnan(vibrationMagnitude)) return false;
        if (tiltAngleDeg < 0.0f || tiltAngleDeg > 180.0f) return false;
        if (vibrationMagnitude < 0.0f || vibrationMagnitude > (GRAVITY * 2.0f)) return false;
        return true;
    }
}

bool begin() {
    if (!mpu.begin()) {
        return false;
    }
    mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    return true;
}

bool read(SensorReading &out) {
    float tiltAngleDeg, vibrationMagnitude;

    if (!readAveraged(tiltAngleDeg, vibrationMagnitude)) {
        return false;
    }
    if (!isPhysicallyPlausible(tiltAngleDeg, vibrationMagnitude)) {
        return false;
    }

    out.tilt_angle_deg = tiltAngleDeg;
    out.vibration_magnitude = vibrationMagnitude;
    return true;
}

} 
