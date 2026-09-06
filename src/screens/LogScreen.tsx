import React, {useCallback, useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '../utils/useFocusEffect';
import {listLogs} from '../database/logRepository';
import {LogEntry} from '../types/BatteryStatus';
import {exportLogsToCsv} from '../utils/csvExport';

export function LogScreen() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [message, setMessage] = useState<string>();

  const refresh = useCallback(() => {
    listLogs().then(setLogs).catch(error => {
      setMessage(error instanceof Error ? error.message : 'Failed to load logs');
    });
  }, []);

  useFocusEffect(refresh);

  const exportCsv = async () => {
    const path = await exportLogsToCsv(logs);
    setMessage(`CSV exported: ${path}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Logs</Text>
        <View style={styles.actions}>
          <Pressable style={styles.secondaryButton} onPress={refresh}>
            <Text style={styles.secondaryButtonText}>Refresh</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={exportCsv}>
            <Text style={styles.primaryButtonText}>Export CSV</Text>
          </Pressable>
        </View>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <FlatList
        data={logs}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({item}) => (
          <View style={styles.row}>
            <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
            <Text style={styles.values}>
              {item.totalVoltage?.toFixed(2) ?? '--'} V · {item.current?.toFixed(2) ?? '--'} A ·{' '}
              {item.soc?.toFixed(0) ?? '--'} % · {item.batteryTemperature?.toFixed(1) ?? '--'} C
            </Text>
            {item.protectionStatus ? (
              <Text style={styles.fault}>{item.protectionStatus}</Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No saved logs yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    rowGap: 14,
  },
  header: {
    gap: 12,
  },
  title: {
    color: '#17202a',
    fontSize: 24,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#126c57',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#233142',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  message: {
    backgroundColor: '#eef8f4',
    borderColor: '#b8ded2',
    borderRadius: 6,
    borderWidth: 1,
    color: '#126c57',
    padding: 10,
  },
  list: {
    gap: 8,
    paddingBottom: 24,
  },
  row: {
    backgroundColor: '#ffffff',
    borderColor: '#d8dee9',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  timestamp: {
    color: '#17202a',
    fontSize: 14,
    fontWeight: '700',
  },
  values: {
    color: '#53606f',
    marginTop: 4,
  },
  fault: {
    color: '#b42318',
    fontWeight: '700',
    marginTop: 4,
  },
  empty: {
    color: '#6b7280',
    paddingTop: 24,
    textAlign: 'center',
  },
});
