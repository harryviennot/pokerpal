import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import {
  amountToCall,
  legalActions,
  snapshotPot,
  snapshotToCall,
  type Action,
  type HandState,
  type LegalAction,
  type SeatIndex,
  type TableSnapshot,
} from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';

import { ActionRow } from './ActionRow';
import { betPresets, clampToBand, isRaise, type RaiseAction } from './betPresets';
import { PreselectRow } from './PreselectRow';
import { PresetStack } from './PresetStack';
import { type GamePhase, type Preselect } from './types';

export interface ActionConsoleProps {
  /** The live hand. The only source of what is legal — the console has no rules. */
  hand: HandState;
  heroSeat: SeatIndex;
  /** The frame on screen, so a size is measured against the pot the player sees. */
  snapshot: TableSnapshot;
  phase: GamePhase;
  preselect: Preselect | null;
  /** One line of live context above the console. Learning mode's equity read. */
  hint?: string | null;
  onAct: (action: Action) => void;
  onPreselect: (preselect: Preselect | null) => void;
}

/** Nothing is legal when it is not the hero's turn, and one array says so forever. */
const NOTHING: readonly LegalAction[] = [];

/**
 * The hero's controls, floating over the felt.
 *
 * No panel and no card: the reference lets the buttons sit on the table, and the
 * space a panel would have taken is the space this redesign was after. Three
 * states, and the phase decides which — the hero on the clock gets the red
 * committing row, anyone else on the clock gets the grey preselect pair, and a hand
 * that is over gets nothing at all, because there is nothing to do but watch the
 * chips move.
 */
export function ActionConsole({
  hand,
  heroSeat,
  snapshot,
  phase,
  preselect,
  hint = null,
  onAct,
  onPreselect,
}: ActionConsoleProps) {
  const hero = hand.players[heroSeat];
  const yourTurn = phase === 'heroTurn' && !hand.complete && hand.toAct === heroSeat;
  const legal = yourTurn ? legalActions(hand) : NOTHING;
  const raise = legal.find(isRaise) ?? null;
  const [betTo, setBetTo] = useBetSizing(hand.events.length, raise);
  const toCall = snapshotToCall(snapshot, heroSeat);
  const stack = hero?.stack ?? 0;

  return (
    <View style={styles.console} pointerEvents="box-none">
      {hint !== null && <Hint label={hint} />}

      {raise && (
        <PresetStack
          presets={betPresets({
            pot: snapshotPot(snapshot),
            toCall: amountToCall(hand, heroSeat),
            committed: hero?.committedThisStreet ?? 0,
            bigBlind: hand.blinds.bigBlind,
            min: raise.min,
            max: raise.max,
            street: hand.street,
          })}
          value={betTo}
          min={raise.min}
          max={raise.max}
          step={hand.blinds.bigBlind}
          onChange={setBetTo}
        />
      )}

      {yourTurn ? (
        <ActionRow legal={legal} betTo={betTo} stack={stack} onAct={onAct} />
      ) : (
        canArm(hand, heroSeat, phase) && (
          <PreselectRow
            facingBet={toCall > 0}
            toCall={toCall}
            stack={stack}
            preselect={preselect}
            onPreselect={onPreselect}
          />
        )
      )}
    </View>
  );
}

/**
 * Whether the hero has a decision still coming in this hand.
 *
 * A folded, busted or all-in seat has nothing left to arm, and neither does a hand
 * that is over — the reference shows an empty console at both, which is what makes
 * the space between hands read as a pause rather than a prompt.
 */
function canArm(hand: HandState, heroSeat: SeatIndex, phase: GamePhase): boolean {
  const hero = hand.players[heroSeat];

  if (!hero || hand.complete || phase === 'handOver' || phase === 'sessionOver') {
    return false;
  }

  return hero.status === 'active' && hero.stack > 0;
}

/**
 * The chips the raise button will commit to.
 *
 * Keyed on the decision — the length of the hand's event log — so every fresh
 * decision opens at the minimum rather than inheriting the last one's size: a sizer
 * left at all-in must not become the default on the next street. Deriving the value
 * from that key rather than resetting it in an effect is what keeps it legal on
 * every render, including the one where the band moved under it.
 */
function useBetSizing(decision: number, raise: RaiseAction | null): [number, (to: number) => void] {
  const [sizing, setSizing] = useState<{ decision: number; to: number } | null>(null);

  if (!raise) {
    return [0, () => undefined];
  }

  const to =
    sizing?.decision === decision ? clampToBand(sizing.to, raise.min, raise.max) : raise.min;

  return [to, (next: number) => setSizing({ decision, to: next })];
}

/** The live equity read, on a frosted strip so it is legible over the felt. */
function Hint({ label }: { label: string }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.hint, { backgroundColor: colors.frostBadge }]}>
      <Text variant="footnote" tabular numberOfLines={1} style={{ color: colors.onFrostBadge }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  console: {
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  hint: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
  },
});
