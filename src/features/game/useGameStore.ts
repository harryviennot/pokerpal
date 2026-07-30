/**
 * The game store: a session, a hand, and the seed streams that make both
 * reproducible.
 *
 * Everything about *when* things happen lives in `gamePump.ts`; this file is the
 * state, the three RNG streams, and the four things a player can do to a table.
 * There is no game until `start` is called — a store that dealt a hand at module
 * load would burn a session on every reload and hand the lobby a table nobody
 * asked for.
 */

import { create } from 'zustand';

import {
  applyAction,
  bySeat,
  createRng,
  isLegalAction,
  makeBot,
  ROCK,
  startNextHand,
  startSession,
  type BotPolicy,
  type SeatIndex,
} from '@/engine';

import { drawAvatars } from './avatars';
import { createGamePump, type Runtime } from './gamePump';
import { createGameScheduler, realTimers } from './gameScheduler';
import { makeArchiver, seatsOf } from './handRecord';
import { DEFAULT_GAME_SETUP, seatsFor, toSessionConfig, type TableSeatSetup } from './tableSetup';
import { type ActiveGame, type GameState } from './types';

/** The seat the player occupies. The table rotates so it is at the bottom. */
export const HERO_SEAT: SeatIndex = 0;

/** Offsets the bot RNG from the deck's so bots and shuffles never share a stream. */
export const BOT_SEED_OFFSET = 0x9e3779b9;

/**
 * Offsets the pacing RNG from both of those.
 *
 * Load-bearing, and the reason there are three streams rather than one: pacing
 * must NEVER draw from `botRng`. Every hand is archived with its seed and
 * replayed from it later, and a think-delay that stole a number from the bot
 * stream would move every decision after it — the replay would deal the same
 * cards and play a different hand. Avatars come off this stream for the mirror
 * image of the same reason: drawing faces must not change how the table plays.
 */
export const PACE_SEED_OFFSET = 0x85ebca6b;

export const useGameStore = create<GameState>((set, get) => {
  const scheduler = createGameScheduler(realTimers());
  let runtime: Runtime | null = null;

  /** Replaces part of the live game. A no-op once there is no game to change. */
  const patch = (change: Partial<ActiveGame>): void => {
    const game = get().game;

    if (game) {
      set({ game: { ...game, ...change } });
    }
  };

  const pump = createGamePump({
    scheduler,
    game: () => get().game,
    runtime: () => runtime,
    patch,
    // Late-bound on purpose: the pump exists before the store object it plays
    // the hero's armed and timed-out actions through.
    act: (action) => get().act(action),
  });

  return {
    setup: DEFAULT_GAME_SETUP,
    game: null,

    start: (setup, seed = freshSeed()) => {
      // Bumps the scheduler's generation, so a timer left over from the session
      // being replaced cannot fire into this one.
      scheduler.cancelAll();

      const config = toSessionConfig(setup, seed);
      const seats = seatsFor(setup);
      const dealt = startNextHand(startSession(config));
      const paceRng = createRng(seed ^ PACE_SEED_OFFSET);
      // Drawn before any think-delay touches the stream, so the faces at the
      // table are a pure function of the seed however the hands play out.
      const avatars = drawAvatars(seats.length, paceRng);

      runtime = {
        archiver: makeArchiver(config, HERO_SEAT, (saveState) => patch({ saveState })),
        opponents: policiesFor(seats),
        profiles: seats.map((seat) => seat.profile),
        botRng: createRng(seed ^ BOT_SEED_OFFSET),
        paceRng,
        grader: null,
        booked: false,
      };

      set({
        setup,
        game: {
          mode: setup.mode,
          session: dealt.session,
          hand: dealt.hand,
          handSeats: seatsOf(dealt.session),
          heroSeat: HERO_SEAT,
          avatars,
          phase: 'dealing',
          shown: 0,
          preselect: null,
          reviews: [],
          coachHistory: [],
          advice: null,
          runoutEquity: null,
          saveState: 'ok',
          startedAt: scheduler.now(),
          decisionDeadline: null,
          sessionEnd: null,
        },
      });

      pump();
    },

    act: (action) => {
      const game = get().game;

      if (!game) {
        return;
      }

      // A tap against a stale table is ignored rather than thrown: the engine is
      // right to reject it, and the felt is wrong to crash on it.
      if (
        game.hand.complete ||
        game.hand.toAct !== game.heroSeat ||
        !isLegalAction(game.hand, action)
      ) {
        return;
      }

      // Cancelling before applying is how the hero wins the race with their own
      // decision clock: the timeout is already a no-op by the time it fires.
      scheduler.cancelAll();
      patch({ hand: applyAction(game.hand, action), preselect: null, decisionDeadline: null });
      pump();
    },

    setPreselect: (preselect) => patch({ preselect }),

    dismissAdvice: () => patch({ advice: null }),

    leave: () => {
      scheduler.cancelAll();
      runtime = null;
      set({ game: null });
    },

    archiveIdle: () => runtime?.archiver.idle() ?? Promise.resolve(),

    storedSessionId: () => runtime?.archiver.currentSessionId() ?? Promise.resolve(null),
  };
});

/**
 * The table's policies, one per seat.
 *
 * The hero's seat gets one too — never consulted, because the pump asks whose
 * turn it is before it asks anyone to decide, but a hole in the array would be a
 * crash waiting for the first bug that gets past that check.
 */
function policiesFor(seats: readonly TableSeatSetup[]): BotPolicy {
  return bySeat(seats.map((seat) => makeBot(seat.profile ?? ROCK)));
}

/**
 * A seed for a table nobody asked to reproduce.
 *
 * The clock, because a fixed one would deal the same session on every launch —
 * the same cards, the same bots, the same decisions. Every seed is recorded with
 * its session and its hands, so a table is still replayable after the fact; it
 * just is not replayed by accident.
 */
function freshSeed(): number {
  return Date.now() >>> 0;
}
