import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';

export interface StatRowProps {
  label: string;
  value: string;
  /** Tone for the value; the label always reads as secondary. */
  tone?: 'label' | 'secondaryLabel' | 'success' | 'danger';
}

/** A label on the left, its figure on the right — one line of a readout. */
export function StatRow({ label, value, tone = 'label' }: StatRowProps) {
  return (
    <View style={styles.row}>
      <Text variant="subheadline" tone="secondaryLabel">
        {label}
      </Text>
      <Text variant="subheadline" tone={tone} tabular>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
