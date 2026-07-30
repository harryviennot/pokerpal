import { Pressable, StyleSheet } from 'react-native';

import { DecisionRow } from '@/components/coach/DecisionRow';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { MIN_TOUCH_TARGET, radius, spacing } from '@/theme';

import { HIGHLIGHT_LABELS, type SessionHighlight } from './sessionReport';

export interface HighlightCardProps {
  kind: keyof typeof HIGHLIGHT_LABELS;
  highlight: SessionHighlight;
  /** Opens the replay, or null when the hand never reached the disk. */
  onPress: (() => void) | null;
}

/**
 * One hand worth going back to, and the coach's own sentence for why.
 *
 * The reason is the explanation: it is what the engine said about that decision
 * at the time, priced in chips, and rewording it here would be the summary
 * inventing a second opinion.
 */
export function HighlightCard({ kind, highlight, onPress }: HighlightCardProps) {
  const { colors } = useTheme();
  const label = HIGHLIGHT_LABELS[kind];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, hand ${highlight.handNumber}`}
      accessibilityHint={onPress ? 'Opens the hand to replay it' : undefined}
      accessibilityState={{ disabled: onPress === null }}
      disabled={onPress === null}
      onPress={onPress ?? undefined}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.tertiaryBackground, borderRadius: radius.sm },
        pressed && styles.pressed,
      ]}>
      <Text variant="caption" tone="tertiaryLabel" style={styles.label}>
        {`${label.toUpperCase()} · HAND #${highlight.handNumber}`}
      </Text>
      <DecisionRow review={highlight.review} />
      {onPress ? (
        <Text variant="footnote" tone="tint">
          Replay this hand ›
        </Text>
      ) : (
        <Text variant="footnote" tone="secondaryLabel">
          This hand never saved, so it cannot be replayed.
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: MIN_TOUCH_TARGET,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    letterSpacing: 0.6,
  },
  pressed: {
    opacity: 0.7,
  },
});
