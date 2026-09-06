import {Device, BleManager, Subscription} from 'react-native-ble-plx';
import {base64ToBytes} from '../utils/bytes';
import {BatteryStatus} from '../types/BatteryStatus';
import {
  NOTIFY_UUID,
  POLL_INTERVAL_MS,
  QUERY_BATTERY_STATUS_BASE64,
  SERVICE_UUID,
  WRITE_UUID,
} from './bleConstants';
import {LiTimeFrameAssembler} from './LiTimeFrameAssembler';
import {parseLiTimeBatteryStatus} from './LiTimeParser';

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 2000;

export type ConnectionState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface BmsClientEvents {
  onStatus?: (status: BatteryStatus) => void;
  onConnectionState?: (state: ConnectionState) => void;
  onError?: (message: string) => void;
}

export function isLiTimeCandidate(device: Device): boolean {
  const name = device.name ?? device.localName ?? '';
  // Packs advertise either as LT-<model> or as L-<model code>-<serial>,
  // e.g. L-24050BNNA70-XXXXXX on a 24V 50Ah unit.
  return (
    name.startsWith('LT-') ||
    /^L-\d/.test(name) ||
    name.toLowerCase().includes('litime')
  );
}

export class LiTimeBmsClient {
  private connectedDevice?: Device;
  private notifySubscription?: Subscription;
  private disconnectSubscription?: Subscription;
  private pollTimer?: ReturnType<typeof setInterval>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private readonly frameAssembler = new LiTimeFrameAssembler();
  private reconnecting = false;
  private reconnectAttempts = 0;

  constructor(
    private readonly manager: BleManager,
    private readonly events: BmsClientEvents = {},
  ) {}

  get device(): Device | undefined {
    return this.connectedDevice;
  }

  async connect(device: Device): Promise<void> {
    this.events.onConnectionState?.('connecting');
    try {
      const connected = await device.connect({autoConnect: false});
      this.connectedDevice = await connected.discoverAllServicesAndCharacteristics();
      this.monitorDisconnects();
      this.monitorNotifications();
      await this.sendQuery();
      this.startPolling();
      this.reconnectAttempts = 0;
      this.events.onConnectionState?.('connected');
    } catch (error) {
      this.events.onConnectionState?.('error');
      this.events.onError?.(error instanceof Error ? error.message : 'BLE connection failed');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    // A reconnect scheduled by an earlier drop would otherwise fire after this
    // and quietly take the pack's single BLE slot back.
    this.cancelPendingReconnect();
    this.frameAssembler.reset();
    this.notifySubscription?.remove();
    this.disconnectSubscription?.remove();
    const device = this.connectedDevice;
    this.connectedDevice = undefined;
    if (device) {
      try {
        await device.cancelConnection();
      } catch (error) {
        this.events.onError?.(error instanceof Error ? error.message : 'BLE disconnect failed');
      }
    }
    this.events.onConnectionState?.('disconnected');
  }

  async sendQuery(): Promise<void> {
    if (!this.connectedDevice) {
      return;
    }
    try {
      await this.connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        WRITE_UUID,
        QUERY_BATTERY_STATUS_BASE64,
      );
    } catch (error) {
      this.events.onError?.(error instanceof Error ? error.message : 'BLE write failed');
    }
  }

  private monitorNotifications(): void {
    const device = this.connectedDevice;
    if (!device) {
      return;
    }

    this.notifySubscription?.remove();
    this.frameAssembler.reset();
    this.notifySubscription = device.monitorCharacteristicForService(
      SERVICE_UUID,
      NOTIFY_UUID,
      (error, characteristic) => {
        if (error) {
          this.events.onError?.(error.message);
          return;
        }
        if (!characteristic?.value || !this.connectedDevice) {
          return;
        }

        const bytes = base64ToBytes(characteristic.value);
        const frames = this.frameAssembler.push(bytes);
        for (const frame of frames) {
          const status = parseLiTimeBatteryStatus(frame, {
            deviceId: this.connectedDevice.id,
            deviceName: this.connectedDevice.name ?? this.connectedDevice.localName ?? undefined,
          });
          if (status) {
            this.events.onStatus?.(status);
          }
        }
      },
    );
  }

  private monitorDisconnects(): void {
    const device = this.connectedDevice;
    if (!device) {
      return;
    }

    this.disconnectSubscription?.remove();
    this.disconnectSubscription = this.manager.onDeviceDisconnected(device.id, () => {
      this.stopPolling();
      this.events.onConnectionState?.('disconnected');
      this.tryReconnect(device);
    });
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      this.sendQuery();
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private cancelPendingReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.reconnecting = false;
    this.reconnectAttempts = 0;
  }

  // Packs accept a single BLE connection, so retrying forever keeps every other
  // app - the official one included - locked out. Back off, then give up and let
  // the user reconnect deliberately.
  private async tryReconnect(device: Device): Promise<void> {
    if (this.reconnecting) {
      return;
    }
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.events.onError?.(
        'Lost the connection and stopped retrying. Reconnect from the scan tab when the battery is free.',
      );
      return;
    }

    this.reconnecting = true;
    this.reconnectAttempts += 1;
    const delay = RECONNECT_BASE_DELAY_MS * this.reconnectAttempts;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      try {
        await this.connect(device);
      } catch {
        this.events.onConnectionState?.('disconnected');
      } finally {
        this.reconnecting = false;
      }
    }, delay);
  }
}
