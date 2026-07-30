import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';
import { MIN_TOUCH_TARGET, spacing } from '@/theme';

import { HighlightCard } from './HighlightCard';
import { type SessionHighlights as Highlights } from './sessionReport';
import { type SessionHandsState } from './useSessionHands';

export interface SessionHighlightsProps {
  highlights: Highlights;
  /** The stored rows this session's hands were written to. */
  hands: SessionHandsState;
  /** Opens a stored hand. The section knows ids, the screen knows routes. */
  onReplay: (handId: number) => void;
  onRetry: () => void;
}

/**
 * The two hands worth going back to: the decision that went best and the one
 * that cost the most.
 *
 * Both cards render as soon as the coach has them, whether or not the disk has
 * caught up — the verdict is the point and the replay is the extra. What the
 * replay link says depends on that lookup, so a card is never a button that does
 * nothing.
 */
export function SessionHighlights({
  highlights,
  hands,
  onReplay,
  onRetry,
}: SessionHighlightsProps) {
  const { best, worst } = highlights;

  if (!best && !worst) {
    return (
      <Section title="Hands to go back to">
        <Text variant="subheadline" tone="secondaryLabel">
          No hand got far enough for the coach to grade a decision.
        </Text>
      </Section>
    );
  }

  const replay = (handNumber: number): (() => void) | null => {
    const id = hands.status === 'ready' ? hands.idByHandNumber.get(handNumber) : undefined;

    return id === undefined ? null : () => onReplay(id);
  };

  return (
    <Section title="Hands to go back to">
      {best && <HighlightCard kind="best" highlight={best} onPress={replay(best.handNumber)} />}
      {worst && <HighlightCard kind="worst" highlight={worst} onPress={replay(worst.handNumber)} />}

      {hands.status === 'loading' && (
        <View style={styles.row}>
          <ActivityIndicator accessibilityLabel="Finding your saved hands" />
          <Text variant="footnote" tone="secondaryLabel">
            Finding your saved hands…
          </Text>
        </View>
      )}

      {hands.status === 'error' && (
        <View>
          <Text variant="footnote" tone="danger">
            Your saved hands could not be read, so there is nothing to replay.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try again"
            onPress={onRetry}
            style={styles.retry}>
            <Text variant="footnote" tone="tint">
              Try again
            </Text>
          </Pressable>
        </View>
      )}

      {hands.status === 'empty' && (
        <Text variant="footnote" tone="secondaryLabel">
          This session was not saved, so its hands cannot be replayed.
        </Text>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  retry: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
});
