import React, {createContext, PropsWithChildren, useContext, useMemo} from 'react';
import {BleManager} from 'react-native-ble-plx';

const BleManagerContext = createContext<BleManager | undefined>(undefined);

export function BleManagerProvider({children}: PropsWithChildren) {
  const manager = useMemo(() => new BleManager(), []);
  return React.createElement(BleManagerContext.Provider, {value: manager}, children);
}

export function useBleManager(): BleManager {
  const manager = useContext(BleManagerContext);
  if (!manager) {
    throw new Error('useBleManager must be used within BleManagerProvider');
  }
  return manager;
}
