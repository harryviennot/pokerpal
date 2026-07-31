import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { MIN_TOUCH_TARGET, radius, spacing } from '@/theme';

import { StepperRow } from './StepperRow';
import { type PotEntry } from './useLivePlayStore';

export interface PotEntryPanelProps {
  entry: PotEntry | null;
  onCommit: (entry: PotEntry) => void;
}

/** Steps a thumb can hit between hands: fine below ten blinds, coarser above. */
function stepFor(value: number): number {
  return value < 10 ? 1 : value < 50 ? 5 : 10;
}

/**
 * The Tier 2 quick-tap entry: pot and bet facing, in big blinds, built for
 * five taps or fewer (PRD A3/A4 — vision cannot read bets reliably, so this
 * is the trustworthy path).
 */
export function PotEntryPanel({ entry, onCommit }: PotEntryPanelProps) {
  const [pot, setPot] = useState(entry?.pot ?? 0);
  const [toCall, setToCall] = useState(entry?.toCall ?? 0);

  const commit = (nextPot: number, nextToCall: number): void => {
    setPot(nextPot);
    setToCall(nextToCall);
    void Haptics.selectionAsync();
    onCommit({ pot: nextPot, toCall: nextToCall });
  };

  return (
    <View style={styles.panel}>
      <StepperRow
        label="Pot (bb)"
        value={pot}
        onDecrease={() => commit(Math.max(0, pot - stepFor(pot)), toCall)}
        onIncrease={() => commit(pot + stepFor(pot + 1), toCall)}
      />
      <StepperRow
        label="Bet to you (bb)"
        value={toCall}
        onDecrease={() => commit(pot, Math.max(0, toCall - stepFor(toCall)))}
        onIncrease={() => commit(pot, toCall + stepFor(toCall + 1))}
      />
      <View style={styles.presets}>
        {PRESETS.map((preset) => (
          <PresetButton
            key={preset.label}
            label={preset.label}
            disabled={pot === 0}
            onPress={() => commit(pot, Math.round(pot * preset.fraction))}
          />
        ))}
      </View>
    </View>
  );
}

const PRESETS = [
  { label: '½ pot', fraction: 0.5 },
  { label: 'Pot', fraction: 1 },
  { label: '2× pot', fraction: 2 },
] as const;

function PresetButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.preset,
        { backgroundColor: colors.tertiaryBackground },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <Text variant="subheadline">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.sm,
  },
  presets: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  preset: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.35,
  },
});
