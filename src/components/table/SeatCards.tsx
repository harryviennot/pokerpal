import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { PlayingCard, type PlayingCardSize } from '@/components/ui/PlayingCard';
import { type Card } from '@/engine';
import { useMotionPrefs } from '@/hooks/useMotionPrefs';
import { radius, spacing, springs } from '@/theme';

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
  /**
   * The hero's fan sits open: on the clock, at showdown, or once the hand is
   * over. Tucked only while the hand is live and the turn is elsewhere.
   */
  open?: boolean;
}

/** The hand a seat is holding, tucked behind its name plate. */
export function SeatCards({
  cards,
  faceUp,
  hero,
  winningFive,
  badge = null,
  open = false,
}: SeatCardsProps) {
  const lift = useTurnLift(hero && open);

  if (cards === null) {
    return <View style={styles.spacer} />;
  }

  const size: PlayingCardSize = hero ? 'xl' : faceUp ? 'medium' : 'small';

  return (
    <View style={[styles.hand, hero && styles.heroDrop]}>
      {cards.map((card, index) => (
        <Animated.View key={card} style={hero ? lift[index === 0 ? 'first' : 'second'] : null}>
          <View style={fan(hero, index)}>
            <DealIn variant="scale">
              <PlayingCard
                size={size}
                card={faceUp ? card : undefined}
                faceDown={!faceUp}
                dimmed={faceUp && winningFive.size > 0 && !winningFive.has(card)}
              />
            </DealIn>
          </View>
        </Animated.View>
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

/** How far each card slides outward when the fan opens, in points. */
const SPREAD = 8;

/** How far the open fan rises, in points. */
const LIFT = 4;

/**
 * The hero's fan reacting to the clock: resting it sits closed — each card
 * tucked inward and the pair a touch lower; when the table turns to the hero
 * it opens out to the fan's ordinary spot. The translate rides outside the
 * fan's own rotation, so opening never disturbs the lean. Instant under
 * reduced motion.
 */
function useTurnLift(up: boolean) {
  const { reduceMotion } = useMotionPrefs();
  const progress = useSharedValue(up ? 1 : 0);

  useEffect(() => {
    const target = up ? 1 : 0;

    progress.value = reduceMotion ? target : withSpring(target, springs.deal);
  }, [up, reduceMotion, progress]);

  const first = useAnimatedStyle(() => ({
    transform: [
      { translateX: SPREAD * (1 - progress.value) },
      { translateY: LIFT * (1 - progress.value) },
    ],
  }));
  const second = useAnimatedStyle(() => ({
    transform: [
      { translateX: -SPREAD * (1 - progress.value) },
      { translateY: LIFT * (1 - progress.value) },
    ],
  }));

  return { first, second };
}

const styles = StyleSheet.create({
  hand: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  // The hero's fan sits deeper behind the plate than the row would put it. A
  // transform rather than a margin, so nothing else in the seat moves.
  heroDrop: {
    transform: [{ translateY: 12 }],
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
    boxShadow: '-3px 0 15px rgba(0, 0, 0, 0.2)',
    borderRadius: radius.xs,
  },
  backFirst: {
    transform: [{ rotate: '-8deg' }],
  },
  backSecond: {
    marginLeft: -spacing.sm,
    transform: [{ rotate: '5deg' }],
    // The same left-cast shadow as the hero's top card, so every seat's top
    // card reads as sitting above the one it overlaps — backs included.
    boxShadow: '-3px 0 15px rgba(0, 0, 0, 0.2)',
    borderRadius: radius.xs,
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
