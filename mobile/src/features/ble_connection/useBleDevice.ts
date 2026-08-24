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

const MAX_RETRY_ATTEMPTS = 4;
const BASE_RETRY_MS = 1_500;
const MAX_RETRY_MS = 20_000;

function backoffMs(attempt: number): number {
  return Math.min(BASE_RETRY_MS * Math.pow(2, attempt), MAX_RETRY_MS);
}

export interface BleDeviceState {
  status: ConnectionStatus | "reconnecting";
  device: DiscoveredDevice | null;
  error: string | null;
  retryAttempt: number;
  maxRetryAttempts: number;
}

type Listener = (state: BleDeviceState) => void;
export class BleDeviceController {
  private state: BleDeviceState = {
    status: "disconnected",
    device: null,
    error: null,
    retryAttempt: 0,
    maxRetryAttempts: MAX_RETRY_ATTEMPTS,
  };
  private listeners: Set<Listener> = new Set();

  private unsubscribeReadings: (() => void) | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private isReconnecting = false;

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
    this._cancelRetry();
    this.setState({ status: "scanning", error: null, device: null, retryAttempt: 0 });
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
        this.setState({ status: "error", error: "Sensor Box не найден рядом." });
      }
    } catch (e) {
      this.setState({ status: "error", error: (e as Error).message });
    }
  }

  async connect(): Promise<void> {
    if (!this.state.device) {
      this.setState({ status: "error", error: "connect() вызван без найденного устройства." });
      return;
    }
    this._cancelRetry();
    this.setState({ status: "connecting", error: null, retryAttempt: 0 });
    try {
      await this.adapter.connect(this.state.device.id);
      this.setState({ status: "connected" });
    } catch (e) {
      this.setState({ status: "error", error: (e as Error).message });
    }
  }

  async disconnect(): Promise<void> {
    this._cancelRetry();
    this.isReconnecting = false;
    this._stopReadings();
    await this.adapter.disconnect();
    this.setState({ status: "disconnected", device: null, error: null, retryAttempt: 0 });
  }

  getAdapter(): BleAdapter {
    return this.adapter;
  }

  startReconnect(onReconnected?: () => void): void {
    if (this.isReconnecting) return;
    this.isReconnecting = true;
    this._doReconnectLoop(0, onReconnected);
  }

  private _doReconnectLoop(attempt: number, onReconnected?: () => void): void {
    if (!this.isReconnecting) return;
    if (attempt >= MAX_RETRY_ATTEMPTS) {
      this.isReconnecting = false;
      this.setState({
        status: "error",
        error: `Потеряно соединение с Sensor Box. ${MAX_RETRY_ATTEMPTS} попытки подключения не удались. Переместитесь ближе и нажмите «Повторить».`,
        retryAttempt: attempt,
      });
      return;
    }

    this.setState({
      status: "reconnecting",
      error: null,
      retryAttempt: attempt,
    });

    const delay = backoffMs(attempt);
    this.retryTimer = setTimeout(async () => {
      if (!this.isReconnecting || !this.state.device) {
        return;
      }

      try {
        await this.adapter.connect(this.state.device.id);
        this.isReconnecting = false;
        this.setState({ status: "connected", error: null, retryAttempt: 0 });
        onReconnected?.();
      } catch {
        this._doReconnectLoop(attempt + 1, onReconnected);
      }
    }, delay);
  }
  private _cancelRetry(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.isReconnecting = false;
  }

  private _stopReadings(): void {
    if (this.unsubscribeReadings) {
      this.unsubscribeReadings();
      this.unsubscribeReadings = null;
    }
  }

  subscribeToReadings(
    onReading: Parameters<BleAdapter["subscribeToReadings"]>[0],
    onError: (error: Error) => void,
    onReconnected?: () => void,
  ): () => void {
    this._stopReadings();

    const unsub = this.adapter.subscribeToReadings(onReading, (error) => {
      this.startReconnect(onReconnected);
      onError(error);
    });

    this.unsubscribeReadings = unsub;
    return () => {
      this.unsubscribeReadings = null;
      unsub();
    };
  }
}

function buildAdapter(): BleAdapter {
  if (env.USE_MOCK_BLE) {
    return createMockBleAdapter({ intervalMs: 1200 });
  }
  throw new Error("Real BLE not configured. Set WOLIS_USE_MOCK_BLE=true or provide a BleManager.");
}

export function useBleDevice() {
  const controllerRef = useRef<BleDeviceController | null>(null);

  if (!controllerRef.current) {
    const adapter = buildAdapter();
    controllerRef.current = new BleDeviceController(adapter);
  }

  const controller = controllerRef.current;

  const [state, setState] = useState<BleDeviceState>(controller.getState());

  useEffect(() => {
    setState(controller.getState());
    return controller.subscribe(setState);
  }, [controller]);

  return {
    ...state,
    scan: () => controller.scan(),
    connect: () => controller.connect(),
    disconnect: () => controller.disconnect(),
    startReconnect: (onReconnected?: () => void) => controller.startReconnect(onReconnected),
    subscribeToReadings: (
      onReading: Parameters<BleDeviceController["subscribeToReadings"]>[0],
      onError: Parameters<BleDeviceController["subscribeToReadings"]>[1],
      onReconnected?: () => void,
    ) => controller.subscribeToReadings(onReading, onError, onReconnected),
    adapter: controller.getAdapter(),
  };
}
