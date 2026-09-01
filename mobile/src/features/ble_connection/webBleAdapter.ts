/**
 * Web Bluetooth API adapter for use when running on web (laptop browser).
 * Uses the browser's navigator.bluetooth instead of react-native-ble-plx.
 * Requires Chrome or Edge with Web Bluetooth enabled.
 *
 * UUIDs must match hardware/ble_service.cpp exactly.
 */
import {
  type BleAdapter,
  type DiscoveredDevice,
  WOLIS_SERVICE_UUID,
  SENSOR_CHARACTERISTIC_UUID,
  DEVICE_NAME_PREFIX,
} from "./bleadapter";
import type { RawSensorPacket } from "../../types/wolis";

// Web Bluetooth delivers raw bytes (ArrayBuffer), not base64 like react-native-ble-plx.
// We decode them directly as UTF-8 JSON here.
function parseRawBytes(text: string): RawSensorPacket {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Decoded BLE payload is not a JSON object");
  }
  const obj = parsed as Record<string, unknown>;
  const requireNum = (field: string) => {
    if (typeof obj[field] !== "number" || !Number.isFinite(obj[field] as number)) {
      throw new Error(`Field "${field}" is missing or not a finite number`);
    }
    return obj[field] as number;
  };
  return {
    temperature_c: requireNum("temperature_c"),
    humidity_pct: requireNum("humidity_pct"),
    pressure_hpa: requireNum("pressure_hpa"),
    illuminance_lux: requireNum("illuminance_lux"),
    tilt_angle_deg: requireNum("tilt_angle_deg"),
    vibration_magnitude: requireNum("vibration_magnitude"),
    shock_detected: typeof obj.shock_detected === "boolean" ? obj.shock_detected : false,
    ...(typeof obj.all_sensors_ok === "boolean" && { all_sensors_ok: obj.all_sensors_ok }),
  };
}

export function createWebBleAdapter(): BleAdapter {
  let bleDevice: BluetoothDevice | null = null;
  let characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  let currentUnsubscribe: (() => void) | null = null;

  return {
    // Web Bluetooth "scan" = requestDevice (shows browser's native device picker dialog)
    async scan(onDeviceFound: (device: DiscoveredDevice) => void): Promise<void> {
      if (!navigator.bluetooth) {
        throw new Error(
          "Web Bluetooth не поддерживается. Используйте Chrome или Edge на ноутбуке."
        );
      }
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: DEVICE_NAME_PREFIX },
          { services: [WOLIS_SERVICE_UUID] },
        ],
        optionalServices: [WOLIS_SERVICE_UUID],
      });
      bleDevice = device;
      onDeviceFound({ id: device.id, name: device.name ?? null });
    },

    async connect(_deviceId: string): Promise<void> {
      if (!bleDevice) throw new Error("Устройство не найдено — сначала запустите поиск.");
      const server = await bleDevice.gatt!.connect();
      const service = await server.getPrimaryService(WOLIS_SERVICE_UUID);
      characteristic = await service.getCharacteristic(SENSOR_CHARACTERISTIC_UUID);
      await characteristic.startNotifications();
    },

    subscribeToReadings(
      onReading: (packet: RawSensorPacket) => void,
      onError: (error: Error) => void
    ): () => void {
      if (!characteristic) {
        onError(new Error("subscribeToReadings вызван до connect()"));
        return () => {};
      }

      // Reassembly buffer: BLE can fragment large payloads across multiple notifications
      let partialBuffer = "";

      const handler = (event: Event) => {
        const char = event.target as BluetoothRemoteGATTCharacteristic;
        if (!char.value) return;
        try {
          const chunk = new TextDecoder("utf-8").decode(char.value.buffer);
          partialBuffer += chunk;

          // Try to parse only when we have a complete JSON object
          const closingBrace = partialBuffer.lastIndexOf("}");
          if (closingBrace === -1) return; // still incomplete

          const candidate = partialBuffer.slice(0, closingBrace + 1);
          partialBuffer = partialBuffer.slice(closingBrace + 1); // keep leftover

          const packet = parseRawBytes(candidate);
          onReading(packet);
        } catch (e) {
          // If parse fails, it might still be partial - keep buffering
          if (e instanceof SyntaxError) {
            // Accumulate; don't call onError yet
            return;
          }
          partialBuffer = ""; // reset on unexpected errors
          onError(e as Error);
        }
      };

      characteristic.addEventListener("characteristicvaluechanged", handler);

      const disconnectHandler = () => {
        onError(new Error("BLE устройство отключилось неожиданно."));
      };
      bleDevice?.addEventListener("gattserverdisconnected", disconnectHandler);

      currentUnsubscribe = () => {
        characteristic?.removeEventListener("characteristicvaluechanged", handler);
        bleDevice?.removeEventListener("gattserverdisconnected", disconnectHandler);
      };

      return currentUnsubscribe;
    },

    async disconnect(): Promise<void> {
      if (currentUnsubscribe) {
        currentUnsubscribe();
        currentUnsubscribe = null;
      }
      if (characteristic) {
        try { await characteristic.stopNotifications(); } catch { /* ignore */ }
        characteristic = null;
      }
      if (bleDevice?.gatt?.connected) {
        bleDevice.gatt.disconnect();
      }
      bleDevice = null;
    },
  };
}
