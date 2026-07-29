import { Host, Slider } from '@expo/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { potRaiseTo } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';
import { formatChips } from '@/utils/format';

export interface BetSizerProps {
  /** Smallest legal total commitment, straight from `legalActions`. */
  min: number;
  /** The hero's whole stack, in the same total-commitment terms. */
  max: number;
  value: number;
  /** Every chip already wagered this hand, the hero's own included. */
  pot: number;
  /** What the hero must add to call. Zero when checking is free. */
  toCall: number;
  /** What the hero has already pushed forward on this street. */
  committed: number;
  onChange: (to: number) => void;
}

/** Pot fractions worth a single tap. All-in is `max`, so it needs no fraction. */
const PRESETS = [
  { label: '½ pot', fraction: 0.5 },
  { label: '¾ pot', fraction: 0.75 },
  { label: 'Pot', fraction: 1 },
] as const;

/**
 * Sizes a bet or raise.
 *
 * The band comes from the engine — `min` is the smallest legal raise and `max`
 * the hero's stack — so the slider cannot express an illegal number, and the
 * presets are clamped into the same band rather than checked against it.
 */
export function BetSizer({ min, max, value, pot, toCall, committed, onChange }: BetSizerProps) {
  const fixed = min >= max;

  return (
    <View style={styles.wrapper}>
      <View style={styles.presets}>
        {PRESETS.map((preset) => (
          <Preset
            key={preset.label}
            label={preset.label}
            onPress={() =>
              onChange(clamp(potRaiseTo(preset.fraction, pot, toCall, committed), min, max))
            }
          />
        ))}
        <Preset label="All in" onPress={() => onChange(max)} />
      </View>

      {/*
        A one-value band has nothing to slide: a shove is the only size left.
        The host takes no `matchContents` — a SwiftUI slider has no width of its
        own, so sizing the host to its content collapses it to a stub.
      */}
      {!fixed && (
        <Host style={styles.slider}>
          <Slider value={value} min={min} max={max} step={1} onValueChange={onChange} />
        </Host>
      )}

      <Text variant="footnote" tone="secondaryLabel" tabular style={styles.readout}>
        {fixed
          ? `All in for ${formatChips(max)}`
          : `${formatChips(min)} to ${formatChips(max)} · pot ${formatChips(pot)}`}
      </Text>
    </View>
  );
}

interface PresetProps {
  label: string;
  onPress: () => void;
}

function Preset({ label, onPress }: PresetProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.preset,
        { backgroundColor: colors.seatPill },
        pressed && styles.pressed,
      ]}>
      <Text variant="footnote" style={{ color: colors.onSeatPill }}>
        {label}
      </Text>
    </Pressable>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  presets: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  preset: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  slider: {
    height: 44,
  },
  readout: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
