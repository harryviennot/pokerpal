import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CardPicker } from '@/components/cards/CardPicker';
import { Button } from '@/components/ui/Button';
import { PlayingCard } from '@/components/ui/PlayingCard';
import { Text } from '@/components/ui/Text';
import { type Card } from '@/engine';
import { spacing } from '@/theme';

import { StepperRow } from './StepperRow';
import { liveUsedCards, useLivePlayStore } from './useLivePlayStore';

/**
 * The two taps a hand starts with (PRD A4: hole cards entered once at hand
 * start), plus who is at the table and how deep hero sits. The first pick is
 * held locally — the store only ever sees a complete hand.
 */
export function HandSetupPanel() {
  const heroCards = useLivePlayStore((state) => state.heroCards);
  const fusion = useLivePlayStore((state) => state.fusion);
  const opponents = useLivePlayStore((state) => state.opponents);
  const heroStackBb = useLivePlayStore((state) => state.heroStackBb);
  const handsObserved = useLivePlayStore((state) => state.handsObserved);

  const setHeroCards = useLivePlayStore((state) => state.setHeroCards);
  const setOpponents = useLivePlayStore((state) => state.setOpponents);
  const setHeroStackBb = useLivePlayStore((state) => state.setHeroStackBb);
  const beginWatching = useLivePlayStore((state) => state.beginWatching);

  const [pendingFirst, setPendingFirst] = useState<Card | null>(null);

  const pick = (card: Card): void => {
    if (pendingFirst !== null) {
      if (card !== pendingFirst) {
        setHeroCards([pendingFirst, card]);
        setPendingFirst(null);
      }

      return;
    }

    // Either the first card of a fresh hand, or starting over on a full one.
    setHeroCards(null);
    setPendingFirst(card);
  };

  const shown: readonly (Card | undefined)[] = heroCards ?? [pendingFirst ?? undefined, undefined];
  const used = [
    ...liveUsedCards({ heroCards, fusion }),
    ...(pendingFirst === null ? [] : [pendingFirst]),
  ];

  return (
    <View style={styles.panel}>
      <Text variant="title2">{handsObserved === 0 ? 'Your cards' : 'Next hand'}</Text>

      <View style={styles.cards}>
        <PlayingCard card={shown[0]} size="large" accessibilityLabel="First hole card" />
        <PlayingCard card={shown[1]} size="large" accessibilityLabel="Second hole card" />
      </View>

      <CardPicker used={used} onPick={pick} />

      <StepperRow
        label="Opponents"
        value={opponents}
        onDecrease={() => setOpponents(opponents - 1)}
        onIncrease={() => setOpponents(opponents + 1)}
      />
      <StepperRow
        label="Your stack"
        value={heroStackBb}
        display={`${heroStackBb} bb`}
        onDecrease={() => setHeroStackBb(heroStackBb - 25)}
        onIncrease={() => setHeroStackBb(heroStackBb + 25)}
      />

      {heroCards !== null ? <Button label="Start watching" onPress={beginWatching} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.base,
  },
  cards: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
});
