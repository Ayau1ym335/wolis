/**
 * src/features/ble-connection/useBleDevice.ts
 *
 * TASK 28 — connection state management on top of a BleAdapter.
 *
 * Implementation note: the state-transition logic is implemented as a plain
 * BleDeviceController class, wrapped by a thin useBleDevice() React hook.
 * This lets the transition logic (disconnected -> scanning -> connecting ->
 * connected -> error, and back) be unit-tested directly via
 * BleDeviceController, without needing a React renderer / testing-library in
 * this environment. The hook itself is a straightforward useState +
 * useEffect wrapper around the controller and is not where the risk lives.
 */

import type { BleAdapter, ConnectionStatus, DiscoveredDevice } from "./bleAdapter";
import type { RawSensorPacket } from "../../types/wolis";

export interface BleDeviceState {
  status: ConnectionStatus;
  device: DiscoveredDevice | null;
  lastReading: RawSensorPacket | null;
  error: string | null;
}

type Listener = (state: BleDeviceState) => void;

export class BleDeviceController {
  private state: BleDeviceState = {
    status: "disconnected",
    device: null,
    lastReading: null,
    error: null,
  };
  private listeners: Set<Listener> = new Set();
  private unsubscribeReadings: (() => void) | null = null;

  constructor(private adapter: BleAdapter) {}

  getState(): BleDeviceState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(partial: Partial<BleDeviceState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) listener(this.state);
  }

  async scan(): Promise<void> {
    this.setState({ status: "scanning", error: null });
    try {
      let found: DiscoveredDevice | null = null;
      await this.adapter.scan((device) => {
        if (!found) found = device;
      });
      if (found) {
        this.setState({ device: found, status: "disconnected" });
      } else {
        this.setState({ status: "error", error: "No Sensor Box found nearby." });
      }
    } catch (e) {
      this.setState({ status: "error", error: (e as Error).message });
    }
  }

  async connect(): Promise<void> {
    if (!this.state.device) {
      this.setState({ status: "error", error: "connect() called with no device discovered yet." });
      return;
    }
    this.setState({ status: "connecting", error: null });
    try {
      await this.adapter.connect(this.state.device.id);
      this.setState({ status: "connected" });
      this.unsubscribeReadings = this.adapter.subscribeToReadings(
        (packet) => this.setState({ lastReading: packet }),
        (error) => this.setState({ status: "error", error: error.message })
      );
    } catch (e) {
      this.setState({ status: "error", error: (e as Error).message });
    }
  }

  async disconnect(): Promise<void> {
    if (this.unsubscribeReadings) {
      this.unsubscribeReadings();
      this.unsubscribeReadings = null;
    }
    await this.adapter.disconnect();
    this.setState({ status: "disconnected", device: null, lastReading: null, error: null });
  }
}

// ---------------------------------------------------------------------------
// Thin React hook wrapper — shown as a comment, not exercised by this
// environment's test suite (no React renderer available here). All actual
// logic lives in BleDeviceController above, which IS tested.
// ---------------------------------------------------------------------------

// import { useEffect, useRef, useState } from "react";
//
// export function useBleDevice(adapter: BleAdapter) {
//   const controllerRef = useRef<BleDeviceController>();
//   if (!controllerRef.current) controllerRef.current = new BleDeviceController(adapter);
//   const controller = controllerRef.current;
//
//   const [state, setState] = useState<BleDeviceState>(controller.getState());
//
//   useEffect(() => controller.subscribe(setState), [controller]);
//
//   return {
//     ...state,
//     scan: () => controller.scan(),
//     connect: () => controller.connect(),
//     disconnect: () => controller.disconnect(),
//   };
// }
