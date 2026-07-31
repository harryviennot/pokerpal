import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { MIN_TOUCH_TARGET, radius, spacing } from '@/theme';

export interface StepperRowProps {
  label: string;
  value: number;
  /** Shown instead of the raw number when given — "100 bb", "2 players". */
  display?: string;
  onDecrease: () => void;
  onIncrease: () => void;
}

/** A labeled −/+ row with thumb-sized targets, LivePlay's one input idiom. */
export function StepperRow({ label, value, display, onDecrease, onIncrease }: StepperRowProps) {
  return (
    <View style={styles.row}>
      <Text variant="subheadline" tone="secondaryLabel">
        {label}
      </Text>
      <View style={styles.stepper}>
        <StepButton label={`Decrease ${label}`} text="−" onPress={onDecrease} />
        <Text variant="headline" tabular style={styles.value}>
          {display ?? value}
        </Text>
        <StepButton label={`Increase ${label}`} text="+" onPress={onIncrease} />
      </View>
    </View>
  );
}

function StepButton({
  label,
  text,
  onPress,
}: {
  label: string;
  text: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        { backgroundColor: colors.tertiaryBackground },
        pressed && styles.pressed,
      ]}>
      <Text variant="title3">{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  step: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    minWidth: 56,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
