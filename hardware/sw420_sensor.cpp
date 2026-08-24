#include "sensors.h"
#include <Arduino.h>

namespace SensorSW420 {

namespace {
    uint8_t digitalPin;
    constexpr uint8_t DEBOUNCE_SAMPLES = 5;
    constexpr uint16_t DEBOUNCE_INTERVAL_MS = 2;
}

void begin(uint8_t pin) {
    digitalPin = pin;
    pinMode(digitalPin, INPUT);
}

void read(SensorReading &out) {
    uint8_t lowCount = 0;
    for (uint8_t i = 0; i < DEBOUNCE_SAMPLES; i++) {
        if (digitalRead(digitalPin) == LOW) {
            lowCount++;
        }
        delay(DEBOUNCE_INTERVAL_MS);
    }
    out.shock_detected = (lowCount > DEBOUNCE_SAMPLES / 2);
}
} 