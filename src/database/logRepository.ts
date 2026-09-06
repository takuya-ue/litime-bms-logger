import SQLite from 'react-native-sqlite-storage';
import {BatteryStatus, LogEntry} from '../types/BatteryStatus';
import {LOG_TABLE_MIGRATIONS, LOG_TABLE_SQL} from './schema';

SQLite.enablePromise(true);

let dbPromise: Promise<SQLite.SQLiteDatabase> | undefined;

async function applyMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const [result] = await db.executeSql('PRAGMA table_info(battery_logs)');
  const existingColumns = new Set<string>();
  for (let index = 0; index < result.rows.length; index += 1) {
    existingColumns.add(result.rows.item(index).name);
  }

  for (const migration of LOG_TABLE_MIGRATIONS) {
    if (!existingColumns.has(migration.column)) {
      await db.executeSql(migration.sql);
    }
  }
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabase({name: 'litime_bms_logger.db', location: 'default'}).then(async db => {
      await db.executeSql(LOG_TABLE_SQL);
      await applyMigrations(db);
      return db;
    });
  }
  return dbPromise;
}

export async function initDatabase(): Promise<void> {
  await getDb();
}

export async function insertLog(status: BatteryStatus): Promise<void> {
  const db = await getDb();
  await db.executeSql(
    `INSERT INTO battery_logs (
      timestamp, deviceId, deviceName, totalVoltage, current, soc,
      remainingAh, fullCapacityAh, batteryTemperature, mosTemperature,
      protectionStatus, rawHex
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      status.timestamp,
      status.deviceId,
      status.deviceName ?? null,
      status.totalVoltage ?? null,
      status.current ?? null,
      status.soc ?? null,
      status.remainingAh ?? null,
      status.fullCapacityAh ?? null,
      status.batteryTemperature ?? null,
      status.mosTemperature ?? null,
      status.protectionStatus ?? null,
      status.rawHex,
    ],
  );
}

export async function listLogs(limit = 500): Promise<LogEntry[]> {
  const db = await getDb();
  const [result] = await db.executeSql(
    'SELECT * FROM battery_logs ORDER BY timestamp DESC LIMIT ?',
    [limit],
  );
  const logs: LogEntry[] = [];
  for (let index = 0; index < result.rows.length; index += 1) {
    logs.push(result.rows.item(index));
  }
  return logs;
}
