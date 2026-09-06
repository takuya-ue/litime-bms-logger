import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {BleError, Device} from 'react-native-ble-plx';
import {useBleManager} from '../ble/BleManagerProvider';
import {ConnectionState, isLiTimeCandidate} from '../ble/LiTimeBmsClient';

interface Props {
  connectionState: ConnectionState;
  onConnect: (device: Device) => Promise<void>;
}

async function requestBlePermissions(): Promise<boolean> {
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

export function DeviceScanScreen({connectionState, onConnect}: Props) {
  const manager = useBleManager();
  const [devicesById, setDevicesById] = useState<Record<string, Device>>({});
  const [scanning, setScanning] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const devices = useMemo(
    () =>
      Object.values(devicesById).sort((left, right) => {
        const leftCandidate = isLiTimeCandidate(left) ? 0 : 1;
        const rightCandidate = isLiTimeCandidate(right) ? 0 : 1;
        return leftCandidate - rightCandidate || (right.rssi ?? -1000) - (left.rssi ?? -1000);
      }),
    [devicesById],
  );

  useEffect(() => {
    return () => {
      manager.stopDeviceScan();
    };
  }, [manager]);

  const startScan = async () => {
    const granted = await requestBlePermissions();
    setPermissionDenied(!granted);
    if (!granted) {
      return;
    }

    setDevicesById({});
    setScanning(true);
    manager.startDeviceScan(null, {allowDuplicates: false}, (error: BleError | null, device: Device | null) => {
      if (error) {
        setScanning(false);
        Alert.alert('BLE scan failed', error.message);
        manager.stopDeviceScan();
        return;
      }
      if (device?.id && (device.name || device.localName)) {
        setDevicesById(previous => ({...previous, [device.id]: device}));
      }
    });
  };

  const stopScan = () => {
    manager.stopDeviceScan();
    setScanning(false);
  };

  const connect = async (device: Device) => {
    stopScan();
    await onConnect(device);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Device Scan</Text>
      {permissionDenied ? (
        <Text style={styles.warning}>Bluetooth permission is required to scan and connect.</Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={scanning ? stopScan : startScan}>
          <Text style={styles.primaryButtonText}>{scanning ? 'Stop Scan' : 'Start Scan'}</Text>
        </Pressable>
        {scanning ? <ActivityIndicator /> : null}
      </View>
      <FlatList
        data={devices}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({item}) => {
          const name = item.name ?? item.localName ?? 'Unknown';
          const candidate = isLiTimeCandidate(item);
          return (
            <View style={[styles.deviceRow, candidate && styles.candidateRow]}>
              <View style={styles.deviceText}>
                <Text style={styles.deviceName}>{name}</Text>
                <Text style={styles.deviceMeta}>{item.id} · RSSI {item.rssi ?? '--'}</Text>
              </View>
              <Pressable
                style={styles.connectButton}
                disabled={connectionState === 'connecting'}
                onPress={() => connect(item)}>
                <Text style={styles.connectButtonText}>Connect</Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No BLE devices found yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    rowGap: 16,
  },
  title: {
    color: '#17202a',
    fontSize: 24,
    fontWeight: '700',
  },
  warning: {
    backgroundColor: '#fff7e6',
    borderColor: '#f0c36a',
    borderRadius: 6,
    borderWidth: 1,
    color: '#7a4b00',
    padding: 10,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#126c57',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  list: {
    gap: 10,
    paddingBottom: 24,
  },
  deviceRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d8dee9',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  candidateRow: {
    borderColor: '#126c57',
  },
  deviceText: {
    flex: 1,
  },
  deviceName: {
    color: '#17202a',
    fontSize: 16,
    fontWeight: '700',
  },
  deviceMeta: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
  },
  connectButton: {
    backgroundColor: '#233142',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  connectButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  empty: {
    color: '#6b7280',
    paddingTop: 24,
    textAlign: 'center',
  },
});
