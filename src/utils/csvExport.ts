import {Platform, Share} from 'react-native';
import RNFS from 'react-native-fs';
import {LogEntry} from '../types/BatteryStatus';

function csvValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatTimestampForFile(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

export function logsToCsv(logs: LogEntry[]): string {
  const headers = [
    'timestamp',
    'deviceId',
    'deviceName',
    'totalVoltage',
    'current',
    'soc',
    'remainingAh',
    'fullCapacityAh',
    'batteryTemperature',
    'mosTemperature',
    'protectionStatus',
    'rawHex',
  ];
  const rows = logs.map(log => headers.map(header => csvValue(log[header as keyof LogEntry])).join(','));
  return [headers.join(','), ...rows].join('\n');
}

export async function exportLogsToCsv(logs: LogEntry[]): Promise<string> {
  const filename = `litime_bms_log_${formatTimestampForFile()}.csv`;
  const baseDir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
  const path = `${baseDir}/${filename}`;
  await RNFS.writeFile(path, logsToCsv(logs), 'utf8');
  await Share.share({url: `file://${path}`, message: path});
  return path;
}
