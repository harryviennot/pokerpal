import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { amountToCall, legalActions, snapshotPot, type LegalAction, type Street } from '@/engine';

import { ActionBar } from './ActionBar';
import { BetSizer } from './BetSizer';
import { HandResult } from './HandResult';
import { PokerTable } from './PokerTable';
import { ReplayControls } from './ReplayControls';
import { useHandReplay } from './useHandReplay';
import { usePracticeStore } from './usePracticeStore';

const STREET_LABELS: Record<Street, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
};

/**
 * Pillar B: a hand of NLHE against the table.
 *
 * The hero's controls come out of `legalActions` and nothing else, so the UI
 * holds no opinion about the rules. The felt renders the newest frame of the
 * hand's own event log; once the hand is over the same controls step back
 * through it, because a played hand and a replayed one are the same data.
 */
export function TableScreen() {
  const hand = usePracticeStore((state) => state.hand);
  const handSeats = usePracticeStore((state) => state.handSeats);
  const heroSeat = usePracticeStore((state) => state.heroSeat);
  const act = usePracticeStore((state) => state.act);
  const nextHand = usePracticeStore((state) => state.nextHand);

  const input = useMemo(
    () => ({ seats: handSeats, events: hand.events }),
    [handSeats, hand.events],
  );
  const replay = useHandReplay(input, { follow: true });
  const { snapshot } = replay;

  const legal = useMemo<readonly LegalAction[]>(
    () => (hand.complete || hand.toAct !== heroSeat ? [] : legalActions(hand)),
    [hand, heroSeat],
  );
  const raise = legal.find((action) => action.type === 'bet' || action.type === 'raise');

  const [betTo, setBetTo] = useBetSizing(hand.events.length, raise);

  return (
    <Screen>
      <PokerTable snapshot={snapshot} heroSeat={heroSeat} />

      <View style={styles.commentary}>
        <Text variant="footnote" tone="secondaryLabel">
          {STREET_LABELS[snapshot.street]} · {replay.index + 1} of {replay.frames.length}
        </Text>
        <Text variant="body" numberOfLines={2}>
          {replay.frame.description}
        </Text>
      </View>

      {hand.complete ? (
        <>
          <ReplayControls
            atStart={replay.atStart}
            atEnd={replay.atEnd}
            onStep={replay.step}
            onStepStreet={replay.stepStreet}
            onRestart={replay.restart}
          />
          <HandResult
            net={(hand.players[heroSeat]?.stack ?? 0) - (handSeats[heroSeat]?.stack ?? 0)}
            onNextHand={nextHand}
          />
        </>
      ) : (
        <>
          {raise && (
            <BetSizer
              min={raise.min}
              max={raise.max}
              value={betTo}
              pot={snapshotPot(snapshot)}
              toCall={amountToCall(hand, heroSeat)}
              committed={hand.players[heroSeat]?.committedThisStreet ?? 0}
              onChange={setBetTo}
            />
          )}
          <ActionBar legal={legal} betTo={betTo} onAct={act} />
        </>
      )}
    </Screen>
  );
}

/**
 * The chips the bet button will commit to.
 *
 * Keyed on the length of the event log so every fresh decision opens at the
 * minimum rather than inheriting the last one's size — a slider left at all-in
 * must not become the default on the next street. Deriving it from that key
 * rather than resetting it in an effect keeps the value legal on every render.
 */
function useBetSizing(
  decision: number,
  raise: LegalAction | undefined,
): [number, (to: number) => void] {
  const [sizing, setSizing] = useState<{ decision: number; to: number } | null>(null);

  if (!raise || (raise.type !== 'bet' && raise.type !== 'raise')) {
    return [0, () => undefined];
  }

  const to =
    sizing?.decision === decision ? Math.min(Math.max(sizing.to, raise.min), raise.max) : raise.min;

  return [to, (next: number) => setSizing({ decision, to: next })];
}

const styles = StyleSheet.create({
  commentary: {
    // A fixed two-line block: the felt above must not jump as the text changes.
    minHeight: 62,
    gap: 2,
  },
});
