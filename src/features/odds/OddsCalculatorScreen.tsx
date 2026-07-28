import { useMemo } from 'react';
import { Pressable } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';
import { detectDraws } from '@/engine';

import { CardPicker } from './CardPicker';
import { CardSlots } from './CardSlots';
import { EquityPanel } from './EquityPanel';
import { OpponentsPanel } from './OpponentsPanel';
import { PotOddsPanel } from './PotOddsPanel';
import { useEquity } from './useEquity';
import {
  boardCards,
  hasBoardGap,
  heroHand,
  usedCards,
  useOddsStore,
  type SlotCards,
} from './useOddsStore';

/**
 * Pillar A: the odds calculator.
 *
 * Route files stay thin — this is the whole screen, composed from the panels
 * beside it. All poker maths lives in `src/engine`.
 */
export function OddsCalculatorScreen() {
  const cards = useOddsStore((state) => state.cards);
  const focusedSlot = useOddsStore((state) => state.focusedSlot);
  const opponentCount = useOddsStore((state) => state.opponentCount);
  const rangePreset = useOddsStore((state) => state.rangePreset);
  const potInput = useOddsStore((state) => state.potInput);
  const betInput = useOddsStore((state) => state.betInput);

  const focusSlot = useOddsStore((state) => state.focusSlot);
  const setCard = useOddsStore((state) => state.setCard);
  const clearSlot = useOddsStore((state) => state.clearSlot);
  const clearAll = useOddsStore((state) => state.clearAll);
  const setOpponentCount = useOddsStore((state) => state.setOpponentCount);
  const setRangePreset = useOddsStore((state) => state.setRangePreset);
  const setPotInput = useOddsStore((state) => state.setPotInput);
  const setBetInput = useOddsStore((state) => state.setBetInput);

  const hero = useMemo(() => heroHand(cards), [cards]);
  const board = useMemo(() => boardCards(cards), [cards]);
  const used = useMemo(() => usedCards(cards), [cards]);
  const boardGap = hasBoardGap(cards);

  const equityState = useEquity({ hero, board, opponentCount, rangePreset });

  const draws = useMemo(
    () => (hero && board.length >= 3 && board.length < 5 ? detectDraws(hero, board) : null),
    [hero, board],
  );

  const anyCards = used.length > 0;

  return (
    <Screen scroll>
      <Section
        title="Cards"
        accessory={
          anyCards ? (
            <Pressable accessibilityRole="button" onPress={clearAll} hitSlop={8}>
              <Text variant="footnote" tone="tint">
                Clear
              </Text>
            </Pressable>
          ) : null
        }>
        <CardSlots
          cards={cards}
          focusedSlot={focusedSlot}
          onFocus={focusSlot}
          onClear={clearSlot}
        />
        <CardPicker used={used} onPick={setCard} />
      </Section>

      <Section title="Opponents">
        <OpponentsPanel
          count={opponentCount}
          onCountChange={setOpponentCount}
          range={rangePreset}
          onRangeChange={setRangePreset}
        />
      </Section>

      <Section title="Equity">
        {renderEquity({ hero, boardGap, cards, equityState, draws })}
      </Section>

      <Section title="Pot odds">
        <PotOddsPanel
          pot={potInput}
          bet={betInput}
          onPotChange={setPotInput}
          onBetChange={setBetInput}
          heroEquity={equityState.result?.equity ?? null}
        />
      </Section>
    </Screen>
  );
}

function renderEquity({
  hero,
  boardGap,
  cards,
  equityState,
  draws,
}: {
  hero: ReturnType<typeof heroHand>;
  boardGap: boolean;
  cards: SlotCards;
  equityState: ReturnType<typeof useEquity>;
  draws: ReturnType<typeof detectDraws> | null;
}) {
  if (!hero) {
    return (
      <Text variant="subheadline" tone="secondaryLabel">
        {cards.hero1 === undefined && cards.hero2 === undefined
          ? 'Pick your hole cards to see your equity.'
          : 'Pick your second hole card.'}
      </Text>
    );
  }

  if (boardGap) {
    return (
      <Text variant="subheadline" tone="secondaryLabel">
        Fill the flop before the turn and river.
      </Text>
    );
  }

  return <EquityPanel state={equityState} draws={draws} />;
}
