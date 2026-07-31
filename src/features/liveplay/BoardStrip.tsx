import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { PlayingCard } from '@/components/ui/PlayingCard';
import { Text } from '@/components/ui/Text';
import { formatCardPretty, type Card } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';

import { type TrackedCandidate } from './fusion';

export interface BoardStripProps {
  board: readonly Card[];
  candidates: readonly TrackedCandidate[];
  /** Hits a candidate needs to lock, for the pending chip's progress count. */
  lockHits: number;
  /** Tap a locked card to correct it. */
  onCorrect: (index: number) => void;
  onConfirm: (card: Card) => void;
  onReject: (card: Card) => void;
}

/**
 * The confirmable-chip row (PRD A2): locked board cards solid, candidates
 * translucent with their confirmation progress, every read one tap from being
 * accepted, corrected or thrown out.
 */
export function BoardStrip({
  board,
  candidates,
  lockHits,
  onCorrect,
  onConfirm,
  onReject,
}: BoardStripProps) {
  const { colors } = useTheme();

  const confirm = (card: Card): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onConfirm(card);
  };

  if (board.length === 0 && candidates.length === 0) {
    return (
      <Text variant="footnote" tone="secondaryLabel">
        Watching for the flop…
      </Text>
    );
  }

  return (
    <View style={styles.row}>
      {board.map((card, index) => (
        <Pressable
          key={card}
          accessibilityRole="button"
          accessibilityLabel={`Board card ${formatCardPretty(card)}. Tap to correct.`}
          onPress={() => onCorrect(index)}>
          <PlayingCard card={card} size="medium" />
        </Pressable>
      ))}

      {candidates.map((candidate) => (
        <View key={candidate.card} style={styles.pending}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Seen ${formatCardPretty(candidate.card)}. Tap to confirm.`}
            onPress={() => confirm(candidate.card)}
            style={styles.translucent}>
            <PlayingCard card={candidate.card} size="medium" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Dismiss ${formatCardPretty(candidate.card)}`}
            hitSlop={8}
            onPress={() => onReject(candidate.card)}
            style={[styles.dismiss, { backgroundColor: colors.secondaryBackground }]}>
            <Text variant="caption" tone="secondaryLabel">
              ✕
            </Text>
          </Pressable>
          <Text variant="caption" tone="secondaryLabel" tabular>
            {Math.min(candidate.hits, lockHits)}/{lockHits}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  pending: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  translucent: {
    opacity: 0.55,
  },
  dismiss: {
    position: 'absolute',
    top: -spacing.xs,
    right: -spacing.xs,
    width: 20,
    height: 20,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
