export type ChargeDischargeStatus = 'idle' | 'charging' | 'discharging' | 'unknown';

export interface BatteryStatus {
  timestamp: number;
  deviceId: string;
  deviceName?: string;
  totalVoltage?: number;
  current?: number;
  soc?: number;
  remainingAh?: number;
  fullCapacityAh?: number;
  cellVoltages: number[];
  batteryTemperature?: number;
  mosTemperature?: number;
  protectionStatus?: string;
  chargeDischargeStatus?: ChargeDischargeStatus;
  soh?: number;
  cycleCount?: number;
  rawHex: string;
}

export interface LogEntry extends BatteryStatus {
  id: number;
}
