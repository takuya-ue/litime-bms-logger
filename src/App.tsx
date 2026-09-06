import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Device} from 'react-native-ble-plx';
import {BleManagerProvider, useBleManager} from './ble/BleManagerProvider';
import {ConnectionState, LiTimeBmsClient} from './ble/LiTimeBmsClient';
import {initDatabase} from './database/logRepository';
import {DashboardScreen} from './screens/DashboardScreen';
import {DeviceScanScreen} from './screens/DeviceScanScreen';
import {LogScreen} from './screens/LogScreen';
import {BatteryStatus} from './types/BatteryStatus';

type Tab = 'scan' | 'dashboard' | 'logs';

async function requestStartupBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  if (Platform.Version >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(result).every(value => value === PermissionsAndroid.RESULTS.GRANTED);
  }

  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function AppContent() {
  const manager = useBleManager();
  const [tab, setTab] = useState<Tab>('scan');
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [status, setStatus] = useState<BatteryStatus>();

  const client = useMemo(
    () =>
      new LiTimeBmsClient(manager, {
        onStatus: setStatus,
        onConnectionState: setConnectionState,
        onError: message => Alert.alert('BLE error', message),
      }),
    [manager],
  );

  useEffect(() => {
    initDatabase().catch(error => {
      Alert.alert('Database error', error instanceof Error ? error.message : 'Failed to initialize database');
    });
    return () => {
      client.disconnect();
      manager.destroy();
    };
  }, [client, manager]);

  const connect = async (device: Device) => {
    await client.connect(device);
    setTab('dashboard');
  };

  const disconnect = async () => {
    await client.disconnect();
    setTab('scan');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f6f8" />
      <View style={styles.appHeader}>
        <Text style={styles.appTitle}>LiTime BMS Logger</Text>
      </View>
      <View style={styles.tabs}>
        {(['scan', 'dashboard', 'logs'] as Tab[]).map(item => (
          <Pressable
            key={item}
            style={[styles.tab, tab === item && styles.activeTab]}
            onPress={() => setTab(item)}>
            <Text style={[styles.tabText, tab === item && styles.activeTabText]}>{item.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.screen}>
        {tab === 'scan' ? <DeviceScanScreen connectionState={connectionState} onConnect={connect} /> : null}
        {tab === 'dashboard' ? (
          <DashboardScreen status={status} connectionState={connectionState} onDisconnect={disconnect} />
        ) : null}
        {tab === 'logs' ? <LogScreen /> : null}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(Platform.OS !== 'android');
  const [permissionDenied, setPermissionDenied] = useState(false);

  const prepare = async () => {
    const granted = await requestStartupBlePermissions();
    setPermissionDenied(!granted);
    setIsReady(granted);
  };

  useEffect(() => {
    prepare().catch(error => {
      Alert.alert('Permission error', error instanceof Error ? error.message : 'Failed to request permission');
    });
  }, []);

  if (!isReady) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#f4f6f8" />
        <View style={styles.permissionGate}>
          <ActivityIndicator />
          <Text style={styles.permissionTitle}>Preparing Bluetooth</Text>
          <Text style={styles.permissionText}>
            {permissionDenied
              ? 'Bluetooth permission is required to start this app.'
              : 'Requesting permissions for BLE access...'}
          </Text>
          {permissionDenied ? (
            <Pressable style={styles.retryButton} onPress={prepare}>
              <Text style={styles.retryButtonText}>Grant Permission</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <BleManagerProvider>
      <AppContent />
    </BleManagerProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#f4f6f8',
    flex: 1,
  },
  appHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  appTitle: {
    color: '#17202a',
    fontSize: 22,
    fontWeight: '800',
  },
  tabs: {
    borderBottomColor: '#d8dee9',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  tab: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomColor: '#126c57',
  },
  tabText: {
    color: '#53606f',
    fontSize: 12,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#126c57',
  },
  screen: {
    flex: 1,
  },
  permissionGate: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  permissionTitle: {
    color: '#17202a',
    fontSize: 20,
    fontWeight: '700',
  },
  permissionText: {
    color: '#53606f',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#126c57',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
