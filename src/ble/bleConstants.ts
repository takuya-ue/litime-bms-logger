import {Buffer} from 'buffer';

export const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
export const NOTIFY_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';
export const WRITE_UUID = '0000ffe2-0000-1000-8000-00805f9b34fb';

export const QUERY_BATTERY_STATUS = Buffer.from([
  0x00, 0x00, 0x04, 0x01,
  0x13, 0x55, 0xaa, 0x17,
]);

export const QUERY_BATTERY_STATUS_BASE64 = QUERY_BATTERY_STATUS.toString('base64');

export const POLL_INTERVAL_MS = 1000;
