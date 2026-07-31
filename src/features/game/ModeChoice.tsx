import { Pressable, StyleSheet, View } from 'react-native';

import { Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { MIN_TOUCH_TARGET, radius, spacing } from '@/theme';

import { DECISION_CLOCK_MS, LEVEL_LENGTH_MS } from './pacing';
import { type GameMode } from './types';

/** Read off the pacing constants, so the promise on screen is the game played. */
const CLOCK_SECONDS = Math.round(DECISION_CLOCK_MS / 1_000);
const LEVEL_MINUTES = Math.round(LEVEL_LENGTH_MS / 60_000);

interface ModeCopy {
  mode: GameMode;
  title: string;
  /** The mode in one line, before any of the detail. */
  pitch: string;
  /** What actually changes. Same three concerns in the same order for both. */
  points: readonly string[];
}

/**
 * The two games, said plainly.
 *
 * Both lists cover the clock, the help and the coaching in that order, so the
 * choice reads as a comparison rather than two adverts.
 */
const MODES: readonly ModeCopy[] = [
  {
    mode: 'learning',
    title: 'Learning',
    pitch: 'Sit and think. The coach is next to you the whole way.',
    points: [
      'No clock — take as long as you like on every decision',
      'Optional guide: the move to make, the size, and why, before you act',
      'The coach grades the hand as soon as it is over',
    ],
  },
  {
    mode: 'real',
    title: 'Real game',
    pitch: 'Play it like it counts, and read the report afterwards.',
    points: [
      `${CLOCK_SECONDS} seconds to act, or the clock checks or folds for you`,
      'No guide, no equity, no pot odds — just the table',
      `Blinds climb every ${LEVEL_MINUTES} minutes, and the report comes at the end`,
    ],
  },
];

export interface ModeChoiceProps {
  mode: GameMode;
  onChange: (mode: GameMode) => void;
}

/** The headline decision of the lobby: which of the two games this is. */
export function ModeChoice({ mode, onChange }: ModeChoiceProps) {
  const { colors } = useTheme();

  return (
    <Section title="How you want to play">
      {MODES.map((copy) => {
        const selected = copy.mode === mode;

        return (
          <Pressable
            key={copy.mode}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={copy.title}
            accessibilityHint={copy.pitch}
            onPress={() => onChange(copy.mode)}
            style={({ pressed }) => [
              styles.option,
              {
                borderRadius: radius.sm,
                backgroundColor: selected ? colors.tertiaryBackground : 'transparent',
                borderColor: selected ? colors.tint : colors.separator,
              },
              pressed && styles.pressed,
            ]}>
            <View style={styles.heading}>
              <Text variant="headline" tone={selected ? 'tint' : 'label'}>
                {copy.title}
              </Text>
              {selected && (
                <Text variant="headline" tone="tint">
                  ✓
                </Text>
              )}
            </View>
            <Text variant="subheadline" tone="secondaryLabel">
              {copy.pitch}
            </Text>
            <View style={styles.points}>
              {copy.points.map((point) => (
                <Text key={point} variant="footnote" tone="secondaryLabel">
                  {`·  ${point}`}
                </Text>
              ))}
            </View>
          </Pressable>
        );
      })}
    </Section>
  );
}

const styles = StyleSheet.create({
  option: {
    minHeight: MIN_TOUCH_TARGET,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.7,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  points: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
});
