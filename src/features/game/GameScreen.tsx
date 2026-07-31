import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameBackdrop } from '@/components/table/GameBackdrop';
import { PokerTable } from '@/components/table/PokerTable';
import { type HandEvent, type LoggedAction } from '@/engine';
import { spacing } from '@/theme';

import { ActionConsole } from './ActionConsole';
import { AdviceBanner } from './AdviceBanner';
import { AVATARS } from './avatars';
import { DecisionClock } from './DecisionClock';
import { TopBar } from './TopBar';
import { type ActiveGame } from './types';
import { useGameStore } from './useGameStore';
import { useLiveEquity } from './useLiveEquity';
import { useRunoutEquity } from './useRunoutEquity';
import { useShownFrame } from './useShownFrame';
import { useStreetSettled } from './useStreetSettled';

/**
 * The felt, full bleed: the screen the player actually looks at.
 *
 * One canvas and three overlays. Everything that used to sit in a stack under the
 * table — a commentary line, replay controls, a coach card, a result row — is gone
 * from live play. It was most of the bottom third of the screen and none of it was
 * something a player does while a hand is in progress; stepping back through a hand
 * belongs in the tracker, where the hand is already over. What is left floats on the
 * backdrop, so the table gets the space back.
 *
 * There is no game until the lobby starts one, so a cold deep link to `/game`
 * arrives with nothing to draw and is sent back rather than crashing.
 */
export function GameScreen() {
  const game = useGameStore((state) => state.game);
  const leave = useGameStore((state) => state.leave);
  const mode = game?.mode ?? null;
  const sessionEnd = game?.sessionEnd ?? null;

  useEffect(() => {
    if (!sessionEnd) {
      return;
    }

    if (mode === 'real') {
      // Real mode has withheld the coaching all session; the summary is where it is
      // finally handed over, so it replaces the table rather than stacking on it —
      // there is no table left to come back to.
      router.replace('/game/summary');

      return;
    }

    // Learning has been coached hand by hand and has nothing left to be told, so
    // clearing the game is the whole exit and the redirect below does the rest.
    leave();
  }, [sessionEnd, mode, leave]);

  if (!game) {
    return <Redirect href="/lobby" />;
  }

  return <Felt game={game} />;
}

/** The table and its overlays, once there is a game to draw. */
function Felt({ game }: { game: ActiveGame }) {
  const insets = useSafeAreaInsets();
  const act = useGameStore((state) => state.act);
  const setPreselect = useGameStore((state) => state.setPreselect);
  const dismissAdvice = useGameStore((state) => state.dismissAdvice);
  const leave = useGameStore((state) => state.leave);

  const { hand, heroSeat, phase, mode } = game;
  const frame = useShownFrame(game);
  const shown = frame?.snapshot ?? null;
  // White only while the table is genuinely waiting on a seat: the engine's
  // `toAct` is ahead of the frames while a burst of events is still revealing,
  // and pointing at it mid-reveal would put the clock on the wrong seat. A
  // street that has just landed holds the clock a beat longer — the card
  // first, then whose move it is.
  const caughtUp = game.shown >= hand.events.length;
  const streetSettled = useStreetSettled(frame?.event ?? null);
  const onClock = caughtUp && !hand.complete && streetSettled ? hand.toAct : null;

  const runout = useRunoutEquity({ snapshot: shown, heroSeat });
  const live = useLiveEquity({ snapshot: shown, heroSeat, enabled: mode === 'learning' });

  if (!frame) {
    return null;
  }

  return (
    <View style={styles.screen}>
      {/* Painted by the screen rather than the table, so the field runs under the
          status bar the way the reference has it. */}
      <GameBackdrop />

      {/* Under the safe area on purpose: the capsule runs to the bezel, and the
          console floats over its bottom edge instead of sitting beside it. */}
      <View style={[styles.table, { top: insets.top }]}>
        <PokerTable
          backdrop={false}
          snapshot={frame.snapshot}
          heroSeat={heroSeat}
          seatAvatars={portraits(game.avatars)}
          seatBadges={runout ?? live.badges ?? undefined}
          actionLabel={verbOf(frame.event)}
          onClock={onClock}
          edgeKeepout={spacing.base}
        />
      </View>

      <View style={[styles.top, { paddingTop: insets.top }]} pointerEvents="box-none">
        <TopBar
          mode={mode}
          startedAt={game.startedAt}
          levels={game.session.levels}
          onLeave={leave}
        />
        <AdviceBanner
          advice={game.advice}
          bigBlind={hand.blinds.bigBlind}
          onDismiss={dismissAdvice}
        />
      </View>

      <View
        style={[styles.bottom, { paddingBottom: insets.bottom + spacing.sm }]}
        pointerEvents="box-none">
        {mode === 'real' && phase === 'heroTurn' && game.decisionDeadline !== null && (
          <View style={styles.clock}>
            <DecisionClock deadline={game.decisionDeadline} />
          </View>
        )}
        <ActionConsole
          hand={hand}
          heroSeat={heroSeat}
          snapshot={frame.snapshot}
          phase={phase}
          preselect={game.preselect}
          hint={live.hint}
          onAct={act}
          onPreselect={setPreselect}
        />
      </View>
    </View>
  );
}

const VERBS: Record<LoggedAction['type'], string> = {
  fold: 'Fold',
  check: 'Check',
  call: 'Call',
  bet: 'Bet',
  raise: 'Raise',
};

/** The verb the acting seat just played, for their name plate. */
function verbOf(event: HandEvent): string | null {
  return event.type === 'actionTaken' ? VERBS[event.action.type] : null;
}

/**
 * Portraits by seat.
 *
 * `game.avatars` holds one index into `AVATARS` per chair and `drawAvatars` keeps
 * them in range; the fallback exists only so the array can never be sparse, since a
 * hole would slide every later seat's face along by one.
 */
function portraits(avatars: readonly number[]): readonly ImageSourcePropType[] {
  return avatars.map((index) => AVATARS[index] ?? FIRST_FACE);
}

const FIRST_FACE: ImageSourcePropType = AVATARS[0] ?? 0;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  table: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.sm,
  },
  clock: {
    paddingHorizontal: spacing.md,
  },
});
