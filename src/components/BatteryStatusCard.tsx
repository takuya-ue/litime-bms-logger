import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {BatteryStatus} from '../types/BatteryStatus';

interface Props {
  status?: BatteryStatus;
}

function formatValue(value: number | undefined, unit: string, digits = 2): string {
  return value === undefined ? '--' : `${value.toFixed(digits)} ${unit}`;
}

export function BatteryStatusCard({status}: Props) {
  // The parser leaves protectionStatus unset when the pack reports nothing
  // wrong, so an absent value on a live status means "no faults", not "unknown".
  const protection = status === undefined ? undefined : status.protectionStatus;
  const hasFault = protection !== undefined;

  return (
    <View style={styles.container}>
      <View style={styles.metric}>
        <Text style={styles.label}>Voltage</Text>
        <Text style={styles.value}>{formatValue(status?.totalVoltage, 'V')}</Text>
      </View>
      <View style={styles.metric}>
        <Text style={styles.label}>Current</Text>
        <Text style={styles.value}>{formatValue(status?.current, 'A')}</Text>
      </View>
      <View style={styles.metric}>
        <Text style={styles.label}>SOC</Text>
        <Text style={styles.value}>{status?.soc === undefined ? '--' : `${status.soc.toFixed(0)} %`}</Text>
      </View>
      <View style={styles.metric}>
        <Text style={styles.label}>Protection</Text>
        <Text style={hasFault ? styles.fault : styles.ok}>
          {status === undefined ? '--' : protection ?? 'OK'}
        </Text>
      </View>
      <View style={styles.metric}>
        <Text style={styles.label}>Raw</Text>
        <Text style={styles.raw} numberOfLines={2}>{status?.rawHex ?? '--'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderColor: '#d8dee9',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    rowGap: 14,
  },
  metric: {
    rowGap: 4,
  },
  label: {
    color: '#53606f',
    fontSize: 13,
    fontWeight: '600',
  },
  value: {
    color: '#17202a',
    fontSize: 28,
    fontWeight: '700',
  },
  ok: {
    color: '#17202a',
    fontSize: 16,
  },
  fault: {
    color: '#b42318',
    fontSize: 16,
    fontWeight: '700',
  },
  raw: {
    color: '#17202a',
    fontFamily: 'monospace',
    fontSize: 12,
  },
});
