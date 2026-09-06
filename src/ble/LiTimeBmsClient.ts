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

export type ConnectionState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface BmsClientEvents {
  onStatus?: (status: BatteryStatus) => void;
  onConnectionState?: (state: ConnectionState) => void;
  onError?: (message: string) => void;
}

export function isLiTimeCandidate(device: Device): boolean {
  const name = device.name ?? device.localName ?? '';
  // Packs advertise either as LT-<model> or as L-<model code>-<serial>,
  // e.g. L-24050BNNA70-B04714 on a 24V 50Ah unit.
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
  private readonly frameAssembler = new LiTimeFrameAssembler();
  private reconnecting = false;

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
      this.events.onConnectionState?.('connected');
    } catch (error) {
      this.events.onConnectionState?.('error');
      this.events.onError?.(error instanceof Error ? error.message : 'BLE connection failed');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
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

  private async tryReconnect(device: Device): Promise<void> {
    if (this.reconnecting) {
      return;
    }
    this.reconnecting = true;
    setTimeout(async () => {
      try {
        await this.connect(device);
      } catch {
        this.events.onConnectionState?.('disconnected');
      } finally {
        this.reconnecting = false;
      }
    }, 2000);
  }
}
