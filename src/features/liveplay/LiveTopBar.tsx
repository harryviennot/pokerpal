import { Pressable, StyleSheet, View } from 'react-native';

import { STREET_LABELS } from '@/components/coach/coachCopy';
import { Text } from '@/components/ui/Text';
import { type Street } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { MIN_TOUCH_TARGET, spacing } from '@/theme';

export interface LiveTopBarProps {
  street: Street | null;
  handsObserved: number;
  /** Shown red while a hand failed to save. */
  saveTrouble: boolean;
  onEndHand: () => void;
}

/** The strip above the stage: where the hand is, and the manual way out of it. */
export function LiveTopBar({ street, handsObserved, saveTrouble, onEndHand }: LiveTopBarProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.bar}>
      <View>
        <Text variant="headline">{street === null ? 'Between hands' : STREET_LABELS[street]}</Text>
        <Text variant="caption" tone="secondaryLabel" tabular>
          {handsObserved} {handsObserved === 1 ? 'hand' : 'hands'} watched
          {saveTrouble ? ' · not saving' : ''}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="End hand"
        onPress={onEndHand}
        hitSlop={8}
        style={styles.endButton}>
        <Text variant="subheadline" style={{ color: colors.tint }}>
          End hand
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.base,
  },
  endButton: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
});
