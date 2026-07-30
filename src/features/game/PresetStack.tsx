import { StyleSheet, View } from 'react-native';

import { MIN_TOUCH_TARGET, spacing } from '@/theme';
import { formatChips } from '@/utils/format';

import { stepRaise, type BetPreset } from './betPresets';
import { ConsoleButton, type ConsoleTone } from './ConsoleButton';

export interface PresetStackProps {
  presets: readonly BetPreset[];
  /** The pending raise, so the size that is chosen reads as chosen. */
  value: number;
  /** The legal band, straight from `legalActions`. Bounds the stepper. */
  min: number;
  max: number;
  /** One nudge of the +/− column, in chips: one big blind. */
  step: number;
  onChange: (amount: number) => void;
}

/**
 * Width of a preset slab, sampled from the reference at a 402-point screen.
 *
 * A fixed width rather than a fraction: the column has to leave the hero's own
 * cards uncovered at the bottom centre of the felt, which is a distance in
 * points, not a share of the screen.
 */
const PRESET_WIDTH = 72;

/**
 * The bet sizes, stacked above the raise button, with a stepper beside them.
 *
 * Only ever on screen while a raise is legal. Every slab is a size the engine
 * offered or a size it refused — a refused one is greyed rather than hidden, so
 * the reason the third of a pot is not available (it is under the minimum bet)
 * stays visible. Selecting sets the pending amount; the raise button commits it.
 *
 * The stepper's two halves are tall on purpose: the reference splits the column
 * in two, which makes both a comfortable target without a caption to explain
 * itself.
 */
export function PresetStack({ presets, value, min, max, step, onChange }: PresetStackProps) {
  return (
    <View style={styles.stack}>
      <View style={styles.column}>
        {presets.map((preset) => (
          <ConsoleButton
            key={preset.id}
            headline={preset.caption === null ? 'All-in' : formatChips(preset.amount)}
            caption={preset.caption}
            label={preset.caption ?? 'All-in'}
            tone={toneFor(preset, value)}
            disabled={!preset.enabled}
            onPress={() => onChange(preset.amount)}
            style={styles.preset}
          />
        ))}
      </View>

      <View style={styles.stepper}>
        <ConsoleButton
          headline="+"
          label="Raise the size by one big blind"
          disabled={value >= max}
          onPress={() => onChange(stepRaise(value, step, min, max))}
          style={styles.step}
        />
        <ConsoleButton
          headline="−"
          label="Lower the size by one big blind"
          disabled={value <= min}
          onPress={() => onChange(stepRaise(value, -step, min, max))}
          style={styles.step}
        />
      </View>
    </View>
  );
}

/** A preset the rules refuse is greyed; the one that is loaded is inverted. */
function toneFor(preset: BetPreset, value: number): ConsoleTone {
  if (!preset.enabled) {
    return 'off';
  }

  return preset.amount === value ? 'armed' : 'quiet';
}

const styles = StyleSheet.create({
  stack: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    gap: spacing.xs,
  },
  column: {
    gap: spacing.xs,
  },
  preset: {
    width: PRESET_WIDTH,
    height: MIN_TOUCH_TARGET,
  },
  stepper: {
    gap: spacing.xs,
  },
  step: {
    width: MIN_TOUCH_TARGET,
    flex: 1,
  },
});
