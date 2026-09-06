export const LOG_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS battery_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  deviceId TEXT NOT NULL,
  deviceName TEXT,
  totalVoltage REAL,
  current REAL,
  soc REAL,
  remainingAh REAL,
  fullCapacityAh REAL,
  batteryTemperature REAL,
  mosTemperature REAL,
  protectionStatus TEXT,
  rawHex TEXT NOT NULL
);
`;

// Columns added after a release shipped. CREATE TABLE IF NOT EXISTS leaves an
// existing table untouched, so databases created before a column was added need
// it applied separately. Each entry is skipped when the column is already there.
export const LOG_TABLE_MIGRATIONS: ReadonlyArray<{column: string; sql: string}> = [
  {
    column: 'protectionStatus',
    sql: 'ALTER TABLE battery_logs ADD COLUMN protectionStatus TEXT',
  },
];
