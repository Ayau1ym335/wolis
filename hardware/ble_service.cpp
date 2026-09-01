#include "ble_service.h"
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <stdio.h>

namespace BleService {

namespace {
    constexpr char SERVICE_UUID[]      = "6f1e2a10-0001-4a5c-9c2e-2f6a1b7d0e01";
    constexpr char CHARACTERISTIC_UUID[] = "6f1e2a10-0002-4a5c-9c2e-2f6a1b7d0e01";

    constexpr uint16_t DESIRED_MTU = 256;

    BLEServer *server = nullptr;
    BLECharacteristic *readingCharacteristic = nullptr;
    bool connected = false;

    class ServerCallbacks : public BLEServerCallbacks {
        void onConnect(BLEServer *s) override {
            connected = true;
        }
        void onDisconnect(BLEServer *s) override {
            connected = false;
            s->getAdvertising()->start();
        }
    };
}

void begin() {
    BLEDevice::init("Wolis-SensorBox");
    BLEDevice::setMTU(DESIRED_MTU);

    server = BLEDevice::createServer();
    server->setCallbacks(new ServerCallbacks());

    BLEService *service = server->createService(SERVICE_UUID);

    readingCharacteristic = service->createCharacteristic(
        CHARACTERISTIC_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    readingCharacteristic->addDescriptor(new BLE2902());

    service->start();

    BLEAdvertising *advertising = server->getAdvertising();
    advertising->addServiceUUID(SERVICE_UUID);
    advertising->setScanResponse(true);
    advertising->start();
}

bool isConnected() {
    return connected;
}

void notifyReading(const SensorReading &reading) {
    if (!connected || readingCharacteristic == nullptr) {
        return;
    }
    char json[256];
    int written = snprintf(json, sizeof(json),
        "{\"temperature_c\":%.2f,\"humidity_pct\":%.2f,\"pressure_hpa\":%.2f,"
        "\"illuminance_lux\":%.2f,\"tilt_angle_deg\":%.2f,"
        "\"vibration_magnitude\":%.2f,\"shock_detected\":%s,"
        "\"all_sensors_ok\":%s}",
        reading.temperature_c,
        reading.humidity_pct,
        reading.pressure_hpa,
        reading.illuminance_lux,
        reading.tilt_angle_deg,
        reading.vibration_magnitude,
        reading.shock_detected ? "true" : "false",
        reading.all_sensors_ok ? "true" : "false"
    );

    if (written <= 0 || written >= static_cast<int>(sizeof(json))) {
        return; 
    }

    readingCharacteristic->setValue(reinterpret_cast<uint8_t *>(json), written);
    readingCharacteristic->notify();
}

}
