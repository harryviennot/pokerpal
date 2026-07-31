import { StyleSheet, View } from 'react-native';

import { PlayingCard, type PlayingCardSize } from '@/components/ui/PlayingCard';
import { type Card } from '@/engine';
import { radius, spacing } from '@/theme';

import { DealIn } from './DealIn';
import { EquityBadge } from './EquityBadge';
import { CARD_PEEK } from './seatMetrics';

export interface SeatCardsProps {
  /** Null once the seat folds or mucks: there is nothing in front of them. */
  cards: readonly [Card, Card] | null;
  /** Face up — the hero always, an opponent only once they show. */
  faceUp: boolean;
  /** The hero holds their cards full size and fanned; everyone else shows backs. */
  hero: boolean;
  /** Cards that play at showdown; face-up cards outside it dim. */
  winningFive: ReadonlySet<Card>;
  /** Frosted badge over the hand — live equity during an all-in run-out. */
  badge?: string | null;
}

/** The hand a seat is holding, tucked behind its name plate. */
export function SeatCards({ cards, faceUp, hero, winningFive, badge = null }: SeatCardsProps) {
  if (cards === null) {
    return <View style={styles.spacer} />;
  }

  const size: PlayingCardSize = hero ? 'xl' : faceUp ? 'medium' : 'small';

  return (
    <View style={styles.hand}>
      {cards.map((card, index) => (
        <View key={card} style={fan(hero, index)}>
          <DealIn variant="scale">
            <PlayingCard
              size={size}
              card={faceUp ? card : undefined}
              faceDown={!faceUp}
              dimmed={faceUp && winningFive.size > 0 && !winningFive.has(card)}
            />
          </DealIn>
        </View>
      ))}

      {badge !== null && (
        // Clipped to the hand's own rounded rect, so the badge is cut by the
        // card corner exactly as it is in the reference.
        <View style={styles.clip} pointerEvents="none">
          <View style={styles.badge}>
            <EquityBadge label={badge} />
          </View>
        </View>
      )}
    </View>
  );
}

/** The hero fans their cards wide; an opponent's backs just lean on each other. */
function fan(hero: boolean, index: number) {
  if (hero) {
    return index === 0 ? styles.heroFirst : styles.heroSecond;
  }

  return index === 0 ? styles.backFirst : styles.backSecond;
}

const styles = StyleSheet.create({
  hand: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  // Holds the plate down to the same place when a seat has no cards, so folding
  // does not make the whole seat jump.
  spacer: {
    height: CARD_PEEK,
  },
  heroFirst: {
    transform: [{ rotate: '-4deg' }],
  },
  heroSecond: {
    marginLeft: -spacing.md,
    transform: [{ rotate: '5deg' }],
    // Left-cast shadow so the top card reads as sitting above the one it overlaps.
    boxShadow: '-6px 0 10px rgba(0, 0, 0, 0.35)',
    borderRadius: radius.xs,
  },
  backFirst: {
    transform: [{ rotate: '-8deg' }],
  },
  backSecond: {
    marginLeft: -spacing.sm,
    transform: [{ rotate: '5deg' }],
  },
  clip: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    borderRadius: radius.sm,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  // Clear of the plate that overlaps the bottom of the hand, so a badge is never
  // hidden by the name in front of it.
  badge: {
    marginBottom: spacing.md,
  },
});
