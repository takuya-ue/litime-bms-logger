import {BatteryStatus, ChargeDischargeStatus} from '../types/BatteryStatus';
import {bytesToHex, readInt16LE, readInt32LE, readUInt16LE, readUInt32LE} from '../utils/bytes';

export interface ParseOptions {
  deviceId: string;
  deviceName?: string;
}

// ---------------------------------------------------------------------------
// LiTime status frame (little endian).
//
// The BMS answers the 0x13 status query with a 105 byte 0x93 frame. Offsets
// follow the community protocol notes published by rubenmuehlhans/litime-ble-hacs
// (MIT), cross-checked here against an L-24050BNNA70 (24V 8S 50Ah) pack.
//
// The response checksum is not part of those notes; it was derived from the
// captures and held on every frame: the trailing byte equals the sum of all
// preceding bytes mod 256.
// ---------------------------------------------------------------------------

const STATUS_RESPONSE = 0x93;
const HEADER_LENGTH = 4;
const STATUS_FRAME_LENGTH = 105;

// Bytes 8-11 are undocumented and are not a voltage: they sat ~20 mV above the
// pack voltage across one session, then read 5124 in another while the pack
// itself stayed at 26294 mV with SOC unchanged. Left alone until understood.
const TOTAL_VOLTAGE_OFFSET = 12; // u32 LE, mV (equals the sum of the cells)
const CELLS_OFFSET = 16; // u16 LE x MAX_CELLS, mV
const MAX_CELLS = 16;
// Reads 0 with nothing connected, which is what the pack reports at rest. The
// offset itself still wants a capture taken under charge or load to confirm.
const CURRENT_OFFSET = 48; // i32 LE, mA (negative = discharging)
const CELL_TEMPERATURE_OFFSET = 52; // i16 LE, degrees C
const MOS_TEMPERATURE_OFFSET = 54; // i16 LE, degrees C
const REMAINING_CAPACITY_OFFSET = 62; // u16 LE, 0.01 Ah
const FULL_CAPACITY_OFFSET = 64; // u16 LE, 0.01 Ah
const PROTECTION_FLAGS_OFFSET = 76; // u32 LE
const SOC_OFFSET = 90; // u16 LE, percent
const SOH_OFFSET = 92; // u16 LE, percent
const CYCLE_COUNT_OFFSET = 96; // u32 LE

const CELL_SUM_TOLERANCE_V = 0.05;

const PROTECTION_FLAGS: ReadonlyArray<readonly [number, string]> = [
  [0x00000004, 'cell overcharge'],
  [0x00000020, 'cell over-discharge'],
  [0x00000040, 'charge overcurrent'],
  [0x00000080, 'discharge overcurrent'],
  [0x00000100, 'high temperature 1'],
  [0x00000200, 'high temperature 2'],
  [0x00000400, 'low temperature 1'],
  [0x00000800, 'low temperature 2'],
  [0x00004000, 'short circuit'],
];

const DOCUMENTED_PROTECTION_MASK = PROTECTION_FLAGS.reduce((mask, [bit]) => mask | bit, 0);

function statusFromCurrent(current?: number): ChargeDischargeStatus {
  if (current === undefined) {
    return 'unknown';
  }
  if (current > 0.05) {
    return 'charging';
  }
  if (current < -0.05) {
    return 'discharging';
  }
  return 'idle';
}

function isInRange(value: number | undefined, min: number, max: number): value is number {
  return value !== undefined && value >= min && value <= max;
}

function toHex32(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
}

function checksum(bytes: Uint8Array): number {
  let sum = 0;
  for (let index = 0; index < bytes.length - 1; index += 1) {
    sum += bytes[index];
  }
  return sum & 0xff;
}

function isStatusFrame(bytes: Uint8Array): boolean {
  if (bytes.length < STATUS_FRAME_LENGTH) {
    return false;
  }
  if (bytes[0] !== 0x00 || bytes[1] !== 0x00) {
    return false;
  }
  if (bytes[2] + HEADER_LENGTH !== bytes.length) {
    return false;
  }
  if (bytes[4] !== STATUS_RESPONSE) {
    return false;
  }
  return checksum(bytes) === bytes[bytes.length - 1];
}

function readCellVoltages(bytes: Uint8Array): number[] {
  const cells: number[] = [];
  for (let index = 0; index < MAX_CELLS; index += 1) {
    const millivolts = readUInt16LE(bytes, CELLS_OFFSET + index * 2);
    // Unused cell slots read as zero; the first zero ends the pack.
    if (millivolts === undefined || millivolts === 0) {
      break;
    }
    cells.push(millivolts / 1000);
  }
  return cells;
}

function readTemperature(bytes: Uint8Array, offset: number): number | undefined {
  const celsius = readInt16LE(bytes, offset);
  return isInRange(celsius, -50, 150) ? celsius : undefined;
}

// Returns undefined when the pack reports nothing wrong, so a healthy battery
// leaves the field empty rather than showing a zero flag word.
//
// The word the community notes label "failure flags" (offset 80) is deliberately
// not reported. It read 0x00020001 on a pack that was charged, holding voltage
// and reporting no protection bits, changing in step with the heat-state byte
// rather than with anything faulty. Whatever it is on this firmware, raising an
// alarm on it would cry wolf; the raw frame is logged either way.
function readProtectionStatus(bytes: Uint8Array): string | undefined {
  const protection = readUInt32LE(bytes, PROTECTION_FLAGS_OFFSET);
  if (protection === undefined || protection === 0) {
    return undefined;
  }

  const active = PROTECTION_FLAGS.filter(([mask]) => (protection & mask) !== 0).map(
    ([, label]) => label,
  );

  // Bits outside the documented set still signal a fault, so surface them raw
  // rather than dropping them.
  const undocumented = protection & ~DOCUMENTED_PROTECTION_MASK;
  if (undocumented !== 0) {
    active.push(`protection ${toHex32(undocumented)}`);
  }

  return active.join(', ');
}

function parseStatusFrame(
  bytes: Uint8Array,
  options: ParseOptions,
  rawHex: string,
): BatteryStatus | undefined {
  const totalMillivolts = readUInt32LE(bytes, TOTAL_VOLTAGE_OFFSET);
  const currentMilliamps = readInt32LE(bytes, CURRENT_OFFSET);
  const remainingRaw = readUInt16LE(bytes, REMAINING_CAPACITY_OFFSET);
  const fullRaw = readUInt16LE(bytes, FULL_CAPACITY_OFFSET);
  const soc = readUInt16LE(bytes, SOC_OFFSET);
  const soh = readUInt16LE(bytes, SOH_OFFSET);

  const totalVoltage = totalMillivolts === undefined ? undefined : totalMillivolts / 1000;
  const current = currentMilliamps === undefined ? undefined : currentMilliamps / 1000;
  const cellVoltages = readCellVoltages(bytes);

  if (!isInRange(totalVoltage, 1, 1000)) {
    return undefined;
  }
  if (!isInRange(soc, 0, 100)) {
    return undefined;
  }

  // The pack voltage is reported as the sum of the cells, so a mismatch means
  // the cell array is not where we think it is.
  const cellSum = cellVoltages.reduce((total, volts) => total + volts, 0);
  if (Math.abs(cellSum - totalVoltage) > CELL_SUM_TOLERANCE_V) {
    return undefined;
  }

  return {
    timestamp: Date.now(),
    deviceId: options.deviceId,
    deviceName: options.deviceName,
    totalVoltage,
    current,
    soc,
    remainingAh: remainingRaw === undefined ? undefined : remainingRaw / 100,
    fullCapacityAh: fullRaw === undefined ? undefined : fullRaw / 100,
    cellVoltages,
    batteryTemperature: readTemperature(bytes, CELL_TEMPERATURE_OFFSET),
    mosTemperature: readTemperature(bytes, MOS_TEMPERATURE_OFFSET),
    protectionStatus: readProtectionStatus(bytes),
    chargeDischargeStatus: statusFromCurrent(current),
    soh: isInRange(soh, 0, 100) ? soh : undefined,
    cycleCount: readUInt32LE(bytes, CYCLE_COUNT_OFFSET),
    rawHex,
  };
}

function rawOnlyStatus(options: ParseOptions, rawHex: string): BatteryStatus {
  return {
    timestamp: Date.now(),
    deviceId: options.deviceId,
    deviceName: options.deviceName,
    cellVoltages: [],
    chargeDischargeStatus: 'unknown',
    rawHex,
  };
}

export function parseLiTimeBatteryStatus(
  bytes: Uint8Array,
  options: ParseOptions,
): BatteryStatus | undefined {
  const rawHex = bytesToHex(bytes);

  if (isStatusFrame(bytes)) {
    const status = parseStatusFrame(bytes, options, rawHex);
    if (status) {
      return status;
    }
  }

  return rawOnlyStatus(options, rawHex);
}
