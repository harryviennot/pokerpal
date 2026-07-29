import { create } from 'zustand';

import {
  applyAction,
  bySeat,
  createRng,
  finishHand,
  isLegalAction,
  makeBot,
  playUntilSeat,
  reviewHand,
  ROCK,
  startNextHand,
  startSession,
  type Action,
  type BotPolicy,
  type BotProfile,
  type DecisionReview,
  type HandState,
  type Rng,
  type SeatIndex,
  type SessionConfig,
  type SessionState,
} from '@/engine';
import { getHandHistoryRepo, HandArchiver, type ArchivedHand } from '@/services/handHistory';

import { DEFAULT_SETUP, seatsFor, toSessionConfig, type TableSetup } from './tableSetup';

/** The seat the player occupies. The table rotates so it is at the bottom. */
export const HERO_SEAT: SeatIndex = 0;

/** Offsets the bot RNG from the deck's so bots and shuffles never share a stream. */
const BOT_SEED_OFFSET = 0x9e3779b9;

/**
 * The table's policies, one per seat.
 *
 * The hero's seat gets a policy too — it is never consulted, because
 * `playUntilSeat` stops on the hero, but a hole in the array would be a crash
 * waiting for the first bug that lets the loop past them.
 */
function policiesFor(seats: readonly { profile: BotProfile | null }[]): BotPolicy {
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

/** One finished hand's coaching, kept so the session can be reviewed. */
export interface HandCoachRecord {
  handNumber: number;
  /** The hero's chips won or lost on the hand. */
  net: number;
  reviews: readonly DecisionReview[];
}

export interface PracticeState {
  /** The table the player chose. Every field of it is live on the felt. */
  setup: TableSetup;
  session: SessionState;
  hand: HandState;
  /** Stacks as they were when this hand was dealt, which replay needs. */
  handSeats: readonly { id: string; stack: number }[];
  heroSeat: SeatIndex;
  /** The coach's grades for the current hand. Empty while it is live. */
  reviews: readonly DecisionReview[];
  /** Every earlier hand's grades, oldest first. */
  coachHistory: readonly HandCoachRecord[];
  /** Writes finished hands to local storage. One archiver, one stored session. */
  archiver: HandArchiver;
  /** Whether the last save reached the disk; the review sheet says so if not. */
  saveState: 'ok' | 'error';
  /** What the other five seats do — a spread of the named archetypes. */
  opponents: BotPolicy;
  /** Drawn from once per bot decision, so a session is reproducible from its seed. */
  botRng: Rng;
  /** Plays the hero's decision, then runs the table back round to them. */
  act: (action: Action) => void;
  /** Books the finished hand and deals the next one. */
  nextHand: () => void;
  /** Seats a new table and deals its first hand. The old session is over. */
  configure: (setup: TableSetup, seed?: number) => void;
  /** Re-deals the current table. A fresh seed unless one is given. */
  reset: (seed?: number) => void;
}

export const usePracticeStore = create<PracticeState>((set, get) => {
  const dealFresh = (setup: TableSetup, seed: number) => {
    const config = toSessionConfig(setup, seed);

    return {
      setup,
      ...deal(
        config,
        policiesFor(seatsFor(setup)),
        makeArchiver(config, (status) => set({ saveState: status })),
      ),
    };
  };

  return {
    ...dealFresh(DEFAULT_SETUP, freshSeed()),

    act: (action) => {
      const { hand, handSeats, heroSeat, opponents, botRng, archiver } = get();

      // A tap that arrives against a stale table is ignored rather than thrown:
      // `applyAction` is right to reject it, and the felt is wrong to crash on it.
      if (hand.complete || hand.toAct !== heroSeat || !isLegalAction(hand, action)) {
        return;
      }

      const played = playUntilSeat(applyAction(hand, action), heroSeat, opponents, botRng);
      const reviews = gradeHero(played, handSeats, heroSeat);

      // Archived the moment it finishes: the player who reads the result and
      // kills the app must not lose the hand they just played.
      if (played.complete) {
        archiver.recordHand(toArchived(played, handSeats, heroSeat, reviews));
      }

      set({ hand: played, reviews });
    },

    nextHand: () => {
      const { session, hand, handSeats, heroSeat, opponents, botRng, reviews, coachHistory } =
        get();
      const { archiver } = get();

      if (!hand.complete) {
        return;
      }

      const outgoing = toArchived(hand, handSeats, heroSeat, reviews);

      // Defensive re-save; the repository treats a seen hand number as a no-op.
      archiver.recordHand(outgoing);

      const record: HandCoachRecord = {
        handNumber: outgoing.handNumber,
        net: outgoing.heroNet,
        reviews,
      };
      const booked = finishHand(session, hand);
      const { session: next, hand: dealt } = startNextHand(booked);
      const played = playUntilSeat(dealt, heroSeat, opponents, botRng);
      // From `next`, not `booked`: dealing is what tops a busted seat back up.
      const nextSeats = seatsOf(next);
      // The rare hand that finishes without the hero acting — all in from the
      // blind, say — still deserves its grades and its row.
      const nextReviews = gradeHero(played, nextSeats, heroSeat);

      if (played.complete) {
        archiver.recordHand(toArchived(played, nextSeats, heroSeat, nextReviews));
      }

      set({
        session: next,
        hand: played,
        handSeats: nextSeats,
        reviews: nextReviews,
        coachHistory: [...coachHistory, record],
      });
    },

    configure: (setup, seed = freshSeed()) => set(dealFresh(setup, seed)),

    reset: (seed = freshSeed()) => set(dealFresh(get().setup, seed)),
  };
});

/** Everything a fresh table needs: a session, its first hand, and the bots' turn. */
function deal(
  config: SessionConfig,
  opponents: BotPolicy,
  archiver: HandArchiver,
): Omit<PracticeState, 'setup' | 'act' | 'nextHand' | 'configure' | 'reset'> {
  const opened = startSession(config);
  const { session, hand } = startNextHand(opened);
  const botRng = createRng(config.seed ^ BOT_SEED_OFFSET);
  const played = playUntilSeat(hand, HERO_SEAT, opponents, botRng);
  const handSeats = seatsOf(session);
  const reviews = gradeHero(played, handSeats, HERO_SEAT);

  if (played.complete) {
    archiver.recordHand(toArchived(played, handSeats, HERO_SEAT, reviews));
  }

  return {
    session,
    hand: played,
    handSeats,
    heroSeat: HERO_SEAT,
    reviews,
    coachHistory: [],
    archiver,
    saveState: 'ok',
    opponents,
    botRng,
  };
}

/** One archiver per session: its lazily created row is the session's identity. */
function makeArchiver(
  config: SessionConfig,
  onStatus: (status: 'ok' | 'error') => void,
): HandArchiver {
  return new HandArchiver(
    getHandHistoryRepo,
    {
      style: config.style,
      seed: config.seed,
      heroSeat: HERO_SEAT,
      blinds: config.levels[0] ?? { smallBlind: 0, bigBlind: 0 },
    },
    onStatus,
  );
}

/** Everything the repository needs to keep a finished hand, replayably. */
function toArchived(
  hand: HandState,
  seats: readonly { id: string; stack: number }[],
  heroSeat: SeatIndex,
  reviews: readonly DecisionReview[],
): ArchivedHand {
  return {
    handNumber: hand.handNumber,
    seed: hand.seed,
    button: hand.button,
    blinds: hand.blinds,
    seats,
    events: hand.events,
    heroNet: (hand.players[heroSeat]?.stack ?? 0) - (seats[heroSeat]?.stack ?? 0),
    reviews,
  };
}

/** Samples per graded decision. Review runs once per hand, off the hot path. */
const COACH_ITERATIONS = 1_500;

/**
 * Grades the hero's decisions once a hand has finished; nothing while it is
 * live. A grade shown mid-hand would leak the ranges the coach modelled and
 * tell the player what the table is holding — the PRD's per-decision
 * "training wheels" mode is a deliberate setting, not the default.
 *
 * The seed is the hand's own, so a review never changes its verdict.
 */
function gradeHero(
  hand: HandState,
  seats: readonly { id: string; stack: number }[],
  heroSeat: SeatIndex,
): readonly DecisionReview[] {
  if (!hand.complete) {
    return [];
  }

  return reviewHand(
    {
      seats,
      button: hand.button,
      blinds: hand.blinds,
      handNumber: hand.handNumber,
      seed: hand.seed,
    },
    hand.events,
    heroSeat,
    { rng: createRng(hand.seed), iterations: COACH_ITERATIONS },
  );
}

/**
 * The stacks a hand is about to be dealt from. Taken before the deal, because
 * once blinds are posted the players' stacks no longer say what they started on.
 */
function seatsOf(session: SessionState): readonly { id: string; stack: number }[] {
  return session.seats.map((seat) => ({ id: seat.id, stack: seat.seated ? seat.stack : 0 }));
}
