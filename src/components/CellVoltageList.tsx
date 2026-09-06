import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

interface Props {
  cellVoltages: number[];
}

export function CellVoltageList({cellVoltages}: Props) {
  if (cellVoltages.length === 0) {
    return <Text style={styles.empty}>No cell voltage data yet.</Text>;
  }

  return (
    <View style={styles.grid}>
      {cellVoltages.map((voltage, index) => (
        <View key={`${index}-${voltage}`} style={styles.cell}>
          <Text style={styles.label}>Cell {index + 1}</Text>
          <Text style={styles.value}>{voltage.toFixed(3)} V</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    color: '#6b7280',
    fontSize: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    borderColor: '#d8dee9',
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 104,
    padding: 10,
  },
  label: {
    color: '#53606f',
    fontSize: 12,
  },
  value: {
    color: '#17202a',
    fontSize: 16,
    fontWeight: '700',
  },
});
