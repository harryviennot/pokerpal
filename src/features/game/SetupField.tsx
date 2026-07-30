import { Host } from '@expo/ui';
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { spacing } from '@/theme';

/** A picker is a native control; its host needs a height of its own. */
export const PICKER_HEIGHT = 44;

export interface SetupFieldProps {
  label: string;
  /** A native control — a `Picker`, in every case so far. */
  children: ReactNode;
}

/** One row of the lobby's setup: what is being chosen, and the control for it. */
export function SetupField({ label, children }: SetupFieldProps) {
  return (
    <View style={styles.field}>
      <Text variant="subheadline" tone="secondaryLabel">
        {label}
      </Text>
      <Host style={styles.picker} matchContents>
        {children}
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  picker: {
    minHeight: PICKER_HEIGHT,
  },
});
