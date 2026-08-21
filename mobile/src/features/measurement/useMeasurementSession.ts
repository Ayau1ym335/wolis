/**
 * features/measurement/useMeasurementSession.ts
 *
 * TASK 31 — manages a live measurement session:
 *   • subscribes to BLE readings from the provided adapter
 *   • accumulates packets and exposes the latest one in real time
 *   • tracks session lifecycle: idle → recording → stopped
 *   • on stop, submits the averaged packet to the backend
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { BleAdapter } from "../ble_connection/bleadapter";
import type { RawSensorPacket } from "../../types/wolis";

export type SessionStatus = "idle" | "recording" | "stopped" | "submitting" | "error";

export interface MeasurementSessionState {
  status: SessionStatus;
  latestReading: RawSensorPacket | null;
  /** Running count of packets received so far */
  packetCount: number;
  error: string | null;
}

export interface UseMeasurementSessionResult extends MeasurementSessionState {
  startSession: () => void;
  stopSession: () => void;
}

// ---------------------------------------------------------------------------
// Average helper — collapses all collected packets into a single snapshot
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useMeasurementSession(
  adapter: BleAdapter | null
): UseMeasurementSessionResult & { averagedReading: RawSensorPacket | null } {
  const [state, setState] = useState<MeasurementSessionState>({
    status: "idle",
    latestReading: null,
    packetCount: 0,
    error: null,
  });

  const collectedRef = useRef<RawSensorPacket[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const startSession = useCallback(() => {
    if (!adapter) {
      setState((s) => ({ ...s, status: "error", error: "No BLE adapter — device not connected." }));
      return;
    }
    collectedRef.current = [];
    setState({ status: "recording", latestReading: null, packetCount: 0, error: null });

    unsubscribeRef.current = adapter.subscribeToReadings(
      (packet) => {
        collectedRef.current.push(packet);
        setState((s) => ({
          ...s,
          latestReading: packet,
          packetCount: collectedRef.current.length,
        }));
      },
      (error) => {
        setState((s) => ({ ...s, status: "error", error: error.message }));
        unsubscribeRef.current?.();
        unsubscribeRef.current = null;
      }
    );
  }, [adapter]);

  const stopSession = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setState((s) => ({ ...s, status: "stopped" }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  const averagedReading: RawSensorPacket | null =
    collectedRef.current.length > 0 ? averagePackets(collectedRef.current) : null;

  return { ...state, startSession, stopSession, averagedReading };
}
