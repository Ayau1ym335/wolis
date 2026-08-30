import type { RawSensorPacket } from "../../types/wolis";

// Must match the UUIDs defined in hardware/ble_service.cpp
export const WOLIS_SERVICE_UUID = "6f1e2a10-0001-4a5c-9c2e-2f6a1b7d0e01";
export const SENSOR_CHARACTERISTIC_UUID = "6f1e2a10-0002-4a5c-9c2e-2f6a1b7d0e01";
export const DEVICE_NAME_PREFIX = "Wolis-SensorBox";
 
export type ConnectionStatus = "disconnected" | "scanning" | "connecting" | "connected" | "error";
 
export interface DiscoveredDevice {
  id: string;
  name: string | null;
}
 
export interface BleAdapter {
  scan(onDeviceFound: (device: DiscoveredDevice) => void, timeoutMs?: number): Promise<void>;
  connect(deviceId: string): Promise<void>;
  subscribeToReadings(
    onReading: (packet: RawSensorPacket) => void,
    onError: (error: Error) => void
  ): () => void;
  disconnect(): Promise<void>;
}
 
export class PacketParseError extends Error {
  constructor(message: string, public readonly raw: unknown) {
    super(message);
    this.name = "PacketParseError";
  }
}
 
const REQUIRED_NUMERIC_FIELDS: (keyof RawSensorPacket)[] = [
  "temperature_c",
  "humidity_pct",
  "pressure_hpa",
  "illuminance_lux",
  "tilt_angle_deg",
  "vibration_magnitude",
];

export function parsePacket(base64Value: string): RawSensorPacket {
  let jsonString: string;
  try {
    jsonString = Buffer.from(base64Value, "base64").toString("utf-8");
  } catch (e) {
    throw new PacketParseError("Failed to base64-decode BLE characteristic value", base64Value);
  }
 
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new PacketParseError(`Failed to JSON-parse decoded BLE payload: ${jsonString}`, base64Value);
  }
 
  if (typeof parsed !== "object" || parsed === null) {
    throw new PacketParseError("Decoded BLE payload is not a JSON object", parsed);
  }
 
  const obj = parsed as Record<string, unknown>;
 
  for (const field of REQUIRED_NUMERIC_FIELDS) {
    if (typeof obj[field] !== "number" || !Number.isFinite(obj[field] as number)) {
      throw new PacketParseError(`Field "${field}" is missing or not a finite number`, parsed);
    }
  }
 
  if (typeof obj.shock_detected !== "boolean") {
    throw new PacketParseError('Field "shock_detected" is missing or not a boolean', parsed);
  }
 
  return {
    temperature_c: obj.temperature_c as number,
    humidity_pct: obj.humidity_pct as number,
    pressure_hpa: obj.pressure_hpa as number,
    illuminance_lux: obj.illuminance_lux as number,
    tilt_angle_deg: obj.tilt_angle_deg as number,
    vibration_magnitude: obj.vibration_magnitude as number,
    shock_detected: obj.shock_detected as boolean,
    // Hardware also sends all_sensors_ok — carry it through if present
    ...(typeof obj.all_sensors_ok === "boolean" && { all_sensors_ok: obj.all_sensors_ok }),
  };
}
 
interface BlePlxManagerLike {
  startDeviceScan(
    serviceUUIDs: string[] | null,
    options: unknown,
    listener: (error: Error | null, device: BlePlxDeviceLike | null) => void
  ): void;
  stopDeviceScan(): void;
  connectToDevice(deviceId: string): Promise<BlePlxDeviceLike>;
}
 
interface BlePlxDeviceLike {
  id: string;
  name: string | null;
  discoverAllServicesAndCharacteristics(): Promise<BlePlxDeviceLike>;
  monitorCharacteristicForService(
    serviceUUID: string,
    characteristicUUID: string,
    listener: (error: Error | null, characteristic: { value: string | null } | null) => void
  ): { remove(): void };
  cancelConnection(): Promise<void>;
}
 
export function createRealBleAdapter(manager: BlePlxManagerLike): BleAdapter {
  let connectedDevice: BlePlxDeviceLike | null = null;
 
  return {
    async scan(onDeviceFound, timeoutMs = 10000) {
      return new Promise((resolve, reject) => {
        manager.startDeviceScan([WOLIS_SERVICE_UUID], null, (error, device) => {
          if (error) {
            manager.stopDeviceScan();
            reject(error);
            return;
          }
          if (device && device.name?.startsWith(DEVICE_NAME_PREFIX)) {
            onDeviceFound({ id: device.id, name: device.name });
          }
        });
        setTimeout(() => {
          manager.stopDeviceScan();
          resolve();
        }, timeoutMs);
      });
    },
 
    async connect(deviceId: string) {
      const device = await manager.connectToDevice(deviceId);
      connectedDevice = await device.discoverAllServicesAndCharacteristics();
    },
 
    subscribeToReadings(onReading, onError) {
      if (!connectedDevice) {
        onError(new Error("subscribeToReadings called before connect()"));
        return () => {};
      }
      const subscription = connectedDevice.monitorCharacteristicForService(
        WOLIS_SERVICE_UUID,
        SENSOR_CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            onError(error);
            return;
          }
          if (!characteristic?.value) {
            onError(new Error("Received empty characteristic value"));
            return;
          }
          try {
            const packet = parsePacket(characteristic.value);
            onReading(packet);
          } catch (e) {
            onError(e as Error);
          }
        }
      );
      return () => subscription.remove();
    },
 
    async disconnect() {
      if (connectedDevice) {
        await connectedDevice.cancelConnection();
        connectedDevice = null;
      }
    },
  };
}
 
export interface MockBleAdapterOptions {
  intervalMs?: number;
  baseline?: Partial<RawSensorPacket>;
}
 
export function createMockBleAdapter(options: MockBleAdapterOptions = {}): BleAdapter {
  const intervalMs = options.intervalMs ?? 1500;
  const baseline: RawSensorPacket = {
    temperature_c: 21.0,
    humidity_pct: 45.0,
    pressure_hpa: 1013.0,
    illuminance_lux: 350.0,
    tilt_angle_deg: 0.3,
    vibration_magnitude: 0.03,
    shock_detected: false,
    ...options.baseline,
  };
 
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
 
  function generateReading(): RawSensorPacket {
    return {
      temperature_c: baseline.temperature_c + (Math.random() - 0.5) * 0.4,
      humidity_pct: baseline.humidity_pct + (Math.random() - 0.5) * 2,
      pressure_hpa: baseline.pressure_hpa + (Math.random() - 0.5) * 1,
      illuminance_lux: baseline.illuminance_lux + (Math.random() - 0.5) * 20,
      tilt_angle_deg: Math.max(0, baseline.tilt_angle_deg + (Math.random() - 0.5) * 0.1),
      vibration_magnitude: Math.max(0, baseline.vibration_magnitude + (Math.random() - 0.5) * 0.01),
      shock_detected: baseline.shock_detected,
    };
  }
 
  return {
    async scan(onDeviceFound, _timeoutMs) {
      onDeviceFound({ id: "mock-device-001", name: `${DEVICE_NAME_PREFIX}-MOCK` });
    },
 
    async connect(_deviceId: string) {
    },
 
    subscribeToReadings(onReading, _onError) {
      intervalHandle = setInterval(() => {
        onReading(generateReading());
      }, intervalMs);
      return () => {
        if (intervalHandle) clearInterval(intervalHandle);
      };
    },
 
    async disconnect() {
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
      }
    },
  };
}
 