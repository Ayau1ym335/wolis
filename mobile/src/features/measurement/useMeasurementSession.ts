import { useCallback, useEffect, useRef, useState } from "react";
import type { BleAdapter } from "../ble_connection/bleadapter";
import type { BleDeviceController } from "../ble_connection/useBleDevice";
import type { RawSensorPacket } from "../../types/wolis";

export type SessionStatus = "idle" | "recording" | "stopped" | "submitting" | "error";

export interface MeasurementSessionState {
  status: SessionStatus;
  latestReading: RawSensorPacket | null;
  packetCount: number;
  error: string | null;
  isReconnecting: boolean;
}

export interface UseMeasurementSessionResult extends MeasurementSessionState {
  startSession: () => void;
  stopSession: () => void;
}

function averagePackets(packets: RawSensorPacket[]): RawSensorPacket {
  if (packets.length === 0) throw new Error("No packets to average.");
  const sum = packets.reduce<RawSensorPacket>(
    (acc, p) => ({
      temperature_c: acc.temperature_c + p.temperature_c,
      humidity_pct: acc.humidity_pct + p.humidity_pct,
      pressure_hpa: acc.pressure_hpa + p.pressure_hpa,
      illuminance_lux: acc.illuminance_lux + p.illuminance_lux,
      tilt_angle_deg: acc.tilt_angle_deg + p.tilt_angle_deg,
      vibration_magnitude: acc.vibration_magnitude + p.vibration_magnitude,
      shock_detected: acc.shock_detected || p.shock_detected,
    }),
    {
      temperature_c: 0,
      humidity_pct: 0,
      pressure_hpa: 0,
      illuminance_lux: 0,
      tilt_angle_deg: 0,
      vibration_magnitude: 0,
      shock_detected: false,
    }
  );
  const n = packets.length;
  return {
    temperature_c: sum.temperature_c / n,
    humidity_pct: sum.humidity_pct / n,
    pressure_hpa: sum.pressure_hpa / n,
    illuminance_lux: sum.illuminance_lux / n,
    tilt_angle_deg: sum.tilt_angle_deg / n,
    vibration_magnitude: sum.vibration_magnitude / n,
    shock_detected: sum.shock_detected,
  };
}

export interface MeasurementSessionInput {
  controller?: BleDeviceController | null;
  adapter?: BleAdapter | null;
}

export function useMeasurementSession(
  input: MeasurementSessionInput | BleAdapter | null
): UseMeasurementSessionResult & { averagedReading: RawSensorPacket | null } {
  const controller =
    input && typeof (input as MeasurementSessionInput).controller !== "undefined"
      ? (input as MeasurementSessionInput).controller ?? null
      : null;
  const adapter =
    input && typeof (input as MeasurementSessionInput).adapter !== "undefined"
      ? (input as MeasurementSessionInput).adapter ?? null
      : (input as BleAdapter | null);

  const [state, setState] = useState<MeasurementSessionState>({
    status: "idle",
    latestReading: null,
    packetCount: 0,
    error: null,
    isReconnecting: false,
  });

  const collectedRef = useRef<RawSensorPacket[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const startSession = useCallback(() => {
    if (!adapter && !controller) {
      setState((s) => ({ ...s, status: "error", error: "Нет BLE-адаптера — устройство не подключено.", isReconnecting: false }));
      return;
    }
    collectedRef.current = [];
    setState({ status: "recording", latestReading: null, packetCount: 0, error: null, isReconnecting: false });

    const onReading = (packet: RawSensorPacket) => {
      collectedRef.current.push(packet);
      setState((s) => ({
        ...s,
        latestReading: packet,
        packetCount: collectedRef.current.length,
        isReconnecting: false,
      }));
    };

    const onError = (error: Error) => {
      setState((s) => ({ ...s, isReconnecting: true }));
    };

    const onReconnected = () => {
      setState((s) => ({ ...s, isReconnecting: false }));
    };

    if (controller) {
      unsubscribeRef.current = controller.subscribeToReadings(onReading, onError, onReconnected);
    } else if (adapter) {
      unsubscribeRef.current = adapter.subscribeToReadings(
        onReading,
        (error) => {
          setState((s) => ({ ...s, status: "error", error: error.message, isReconnecting: false }));
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
        }
      );
    }
  }, [adapter, controller]);

  const stopSession = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setState((s) => ({ ...s, status: "stopped", isReconnecting: false }));
  }, []);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  const averagedReading: RawSensorPacket | null =
    collectedRef.current.length > 0 ? averagePackets(collectedRef.current) : null;

  return { ...state, startSession, stopSession, averagedReading };
}
