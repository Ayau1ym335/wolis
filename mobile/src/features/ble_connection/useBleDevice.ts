/**
 * src/features/ble_connection/useBleDevice.ts  (live React hook version)
 *
 * TASK 28 — connection state management on top of a BleAdapter.
 *
 * The BleDeviceController class lives in the same module as the original
 * commented skeleton; this file re-exports everything and adds the live
 * useBleDevice() hook.
 */

import { useEffect, useRef, useState } from "react";
import { env } from "../../config/env";
import {
  createMockBleAdapter,
  createRealBleAdapter,
  type BleAdapter,
  type ConnectionStatus,
  type DiscoveredDevice,
} from "./bleadapter";

export type { ConnectionStatus, DiscoveredDevice };

export interface BleDeviceState {
  status: ConnectionStatus;
  device: DiscoveredDevice | null;
  error: string | null;
}

type Listener = (state: BleDeviceState) => void;

export class BleDeviceController {
  private state: BleDeviceState = {
    status: "disconnected",
    device: null,
    error: null,
  };
  private listeners: Set<Listener> = new Set();

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
    this.setState({ status: "scanning", error: null, device: null });
    try {
      let found: DiscoveredDevice | null = null;
      await this.adapter.scan((device) => {
        if (!found) {
          found = device;
          this.setState({ device: found });
        }
      });
      if (found) {
        this.setState({ status: "disconnected" });
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
    } catch (e) {
      this.setState({ status: "error", error: (e as Error).message });
    }
  }

  async disconnect(): Promise<void> {
    await this.adapter.disconnect();
    this.setState({ status: "disconnected", device: null, error: null });
  }

  getAdapter(): BleAdapter {
    return this.adapter;
  }
}

// ---------------------------------------------------------------------------
// Factory — selects mock or real adapter based on env flag
// ---------------------------------------------------------------------------
function buildAdapter(): BleAdapter {
  if (env.USE_MOCK_BLE) {
    return createMockBleAdapter({ intervalMs: 1200 });
  }
  // In a real RN project: import { BleManager } from "react-native-ble-plx";
  // const manager = new BleManager();
  // return createRealBleAdapter(manager);
  throw new Error("Real BLE not configured. Set USE_MOCK_BLE=true or provide a BleManager.");
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------
export function useBleDevice() {
  const controllerRef = useRef<BleDeviceController | null>(null);

  if (!controllerRef.current) {
    const adapter = buildAdapter();
    controllerRef.current = new BleDeviceController(adapter);
  }

  const controller = controllerRef.current;

  const [state, setState] = useState<BleDeviceState>(controller.getState());

  useEffect(() => {
    return controller.subscribe(setState);
  }, [controller]);

  return {
    ...state,
    scan: () => controller.scan(),
    connect: () => controller.connect(),
    disconnect: () => controller.disconnect(),
    adapter: controller.getAdapter(),
  };
}
