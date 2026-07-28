import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { type RangePreset } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { MIN_TOUCH_TARGET, radius, spacing } from '@/theme';

import { MAX_OPPONENTS, MIN_OPPONENTS } from './useOddsStore';

export type RangeChoice = RangePreset | 'random';

export interface OpponentsPanelProps {
  count: number;
  onCountChange: (count: number) => void;
  range: RangeChoice;
  onRangeChange: (range: RangeChoice) => void;
}

const RANGE_OPTIONS: { value: RangeChoice; label: string }[] = [
  { value: 'random', label: 'Any' },
  { value: 'loose', label: 'Loose' },
  { value: 'standard', label: 'Standard' },
  { value: 'tight', label: 'Tight' },
];

/** How many opponents, and how wide a range each is assumed to play. */
export function OpponentsPanel({
  count,
  onCountChange,
  range,
  onRangeChange,
}: OpponentsPanelProps) {
  const { colors } = useTheme();

  const step = (delta: number): void => {
    void Haptics.selectionAsync();
    onCountChange(count + delta);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.stepperRow}>
        <Text variant="body">Opponents</Text>
        <View style={[styles.stepper, { backgroundColor: colors.tertiaryBackground }]}>
          <StepButton label="−" onPress={() => step(-1)} disabled={count <= MIN_OPPONENTS} />
          <Text variant="headline" tabular style={styles.count}>
            {count}
          </Text>
          <StepButton label="+" onPress={() => step(1)} disabled={count >= MAX_OPPONENTS} />
        </View>
      </View>

      <View style={[styles.segments, { backgroundColor: colors.tertiaryBackground }]}>
        {RANGE_OPTIONS.map((option) => {
          const selected = option.value === range;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={`Opponent range ${option.label}`}
              accessibilityState={{ selected }}
              onPress={() => {
                void Haptics.selectionAsync();
                onRangeChange(option.value);
              }}
              style={[
                styles.segment,
                selected && { backgroundColor: colors.background, borderRadius: radius.sm - 2 },
              ]}>
              <Text variant="footnote" tone={selected ? 'label' : 'secondaryLabel'}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function StepButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Add an opponent' : 'Remove an opponent'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.stepButton, (disabled || pressed) && styles.dim]}>
      <Text variant="title3" style={{ color: disabled ? colors.tertiaryLabel : colors.tint }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.md,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  stepButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    minWidth: 24,
    textAlign: 'center',
  },
  dim: {
    opacity: 0.5,
  },
  segments: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    padding: 2,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET - 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
