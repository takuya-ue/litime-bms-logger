import React, {useEffect, useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {BatteryStatusCard} from '../components/BatteryStatusCard';
import {CellVoltageList} from '../components/CellVoltageList';
import {insertLog, listLogs} from '../database/logRepository';
import {exportLogsToCsv} from '../utils/csvExport';
import {BatteryStatus} from '../types/BatteryStatus';
import {ConnectionState} from '../ble/LiTimeBmsClient';

interface Props {
  status?: BatteryStatus;
  connectionState: ConnectionState;
  onDisconnect: () => Promise<void>;
}

export function DashboardScreen({status, connectionState, onDisconnect}: Props) {
  const [logging, setLogging] = useState(false);
  const [saveIntervalMs, setSaveIntervalMs] = useState(1000);
  const [message, setMessage] = useState<string>();
  const lastSavedAt = useRef(0);

  useEffect(() => {
    if (!logging || !status) {
      return;
    }
    if (Date.now() - lastSavedAt.current < saveIntervalMs) {
      return;
    }
    lastSavedAt.current = Date.now();
    insertLog(status).catch(error => {
      setLogging(false);
      setMessage(error instanceof Error ? error.message : 'Failed to save log');
    });
  }, [logging, saveIntervalMs, status]);

  const toggleLogging = () => {
    if (!status || connectionState !== 'connected') {
      setMessage('Connect a battery and wait for telemetry before starting logs.');
      return;
    }
    setMessage(undefined);
    setLogging(previous => !previous);
  };

  const exportCsv = async () => {
    const logs = await listLogs(5000);
    const path = await exportLogsToCsv(logs);
    setMessage(`CSV exported: ${path}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.state}>Connection: {connectionState}</Text>
        </View>
        <Pressable style={styles.secondaryButton} onPress={onDisconnect}>
          <Text style={styles.secondaryButtonText}>Disconnect</Text>
        </Pressable>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <BatteryStatusCard status={status} />

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Capacity</Text>
        <Text style={styles.row}>Remaining: {status?.remainingAh?.toFixed(2) ?? '--'} Ah</Text>
        <Text style={styles.row}>Full: {status?.fullCapacityAh?.toFixed(2) ?? '--'} Ah</Text>
        <Text style={styles.row}>Battery temp: {status?.batteryTemperature?.toFixed(1) ?? '--'} C</Text>
        <Text style={styles.row}>MOS temp: {status?.mosTemperature?.toFixed(1) ?? '--'} C</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Cell Voltages</Text>
        <CellVoltageList cellVoltages={status?.cellVoltages ?? []} />
      </View>

      <View style={styles.controls}>
        <Pressable
          style={[styles.primaryButton, logging && styles.dangerButton]}
          onPress={toggleLogging}>
          <Text style={styles.primaryButtonText}>{logging ? 'Stop Logging' : 'Start Logging'}</Text>
        </Pressable>
        <Pressable
          style={[styles.intervalButton, saveIntervalMs === 1000 && styles.intervalButtonActive]}
          onPress={() => setSaveIntervalMs(1000)}>
          <Text style={styles.intervalButtonText}>1s</Text>
        </Pressable>
        <Pressable
          style={[styles.intervalButton, saveIntervalMs === 5000 && styles.intervalButtonActive]}
          onPress={() => setSaveIntervalMs(5000)}>
          <Text style={styles.intervalButtonText}>5s</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={exportCsv}>
          <Text style={styles.secondaryButtonText}>Export CSV</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: '#17202a',
    fontSize: 24,
    fontWeight: '700',
  },
  state: {
    color: '#53606f',
    marginTop: 4,
  },
  message: {
    backgroundColor: '#eef8f4',
    borderColor: '#b8ded2',
    borderRadius: 6,
    borderWidth: 1,
    color: '#126c57',
    padding: 10,
  },
  panel: {
    backgroundColor: '#ffffff',
    borderColor: '#d8dee9',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    rowGap: 8,
  },
  panelTitle: {
    color: '#17202a',
    fontSize: 18,
    fontWeight: '700',
  },
  row: {
    color: '#253241',
    fontSize: 15,
  },
  controls: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#126c57',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  dangerButton: {
    backgroundColor: '#a13d3d',
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
  intervalButton: {
    borderColor: '#aab4c0',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  intervalButtonActive: {
    backgroundColor: '#dff1eb',
    borderColor: '#126c57',
  },
  intervalButtonText: {
    color: '#17202a',
    fontWeight: '700',
  },
});
