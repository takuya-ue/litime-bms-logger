import {Buffer} from 'buffer';

export function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'base64'));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function readUInt16LE(bytes: Uint8Array, offset: number): number | undefined {
  if (offset + 1 >= bytes.length) {
    return undefined;
  }
  return bytes[offset] | (bytes[offset + 1] << 8);
}

export function readInt16LE(bytes: Uint8Array, offset: number): number | undefined {
  const value = readUInt16LE(bytes, offset);
  if (value === undefined) {
    return undefined;
  }
  return value & 0x8000 ? value - 0x10000 : value;
}

export function readUInt32LE(bytes: Uint8Array, offset: number): number | undefined {
  if (offset + 3 >= bytes.length) {
    return undefined;
  }
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>> 0
  );
}

export function readInt32LE(bytes: Uint8Array, offset: number): number | undefined {
  const value = readUInt32LE(bytes, offset);
  if (value === undefined) {
    return undefined;
  }
  return value > 0x7fffffff ? value - 0x100000000 : value;
}
