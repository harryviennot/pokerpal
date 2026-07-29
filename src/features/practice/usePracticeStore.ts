import { create } from 'zustand';

import {
  applyAction,
  bySeat,
  CALLING_STATION,
  createRng,
  finishHand,
  isLegalAction,
  makeBot,
  MANIAC,
  playUntilSeat,
  reviewHand,
  ROCK,
  SHARK,
  startNextHand,
  startSession,
  TAG,
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

/** The seat the player occupies. The table rotates so it is at the bottom. */
export const HERO_SEAT: SeatIndex = 0;

const STARTING_STACK = 1000;

/** Offsets the bot RNG from the deck's so bots and shuffles never share a stream. */
const BOT_SEED_OFFSET = 0x9e3779b9;

/**
 * Who sits in each seat, hero first.
 *
 * A spread of personalities rather than five copies of one, so a session shows
 * the player what each type does to them: two solid opponents to lose to, a
 * station to value bet, a maniac to trap, a rock to steal from, and one Shark
 * that reads what the player has been representing. Choosing the mix is the
 * table-configuration slice.
 */
const TABLE: readonly { id: string; profile: BotProfile | null }[] = [
  { id: 'You', profile: null },
  { id: 'Ava', profile: TAG },
  { id: 'Ben', profile: CALLING_STATION },
  { id: 'Cleo', profile: ROCK },
  { id: 'Dev', profile: MANIAC },
  { id: 'Elle', profile: SHARK },
];

/**
 * Six-handed, 5/10, rebuys on. A cash game that never ends is the right default
 * for practice: the player leaves when they want to, not when they bust.
 * Configuring any of this is a later slice.
 */
const DEFAULT_CONFIG: SessionConfig = {
  seats: TABLE.map((seat) => ({ id: seat.id, stack: STARTING_STACK })),
  style: 'cash',
  levels: [{ smallBlind: 5, bigBlind: 10 }],
  rebuyTo: STARTING_STACK,
  seed: 20260728,
};

/**
 * The table's policies, one per seat.
 *
 * The hero's seat gets a policy too — it is never consulted, because
 * `playUntilSeat` stops on the hero, but a hole in the array would be a crash
 * waiting for the first bug that lets the loop past them.
 */
const OPPONENTS: BotPolicy = bySeat(TABLE.map((seat) => makeBot(seat.profile ?? ROCK)));

/** One finished hand's coaching, kept so the session can be reviewed. */
export interface HandCoachRecord {
  handNumber: number;
  /** The hero's chips won or lost on the hand. */
  net: number;
  reviews: readonly DecisionReview[];
}

export interface PracticeState {
  session: SessionState;
  hand: HandState;
  /** Stacks as they were when this hand was dealt, which replay needs. */
  handSeats: readonly { id: string; stack: number }[];
  heroSeat: SeatIndex;
  /** The coach's grades for the current hand. Empty while it is live. */
  reviews: readonly DecisionReview[];
  /** Every earlier hand's grades, oldest first. */
  coachHistory: readonly HandCoachRecord[];
  /** What the other five seats do — a spread of the named archetypes. */
  opponents: BotPolicy;
  /** Drawn from once per bot decision, so a session is reproducible from its seed. */
  botRng: Rng;
  /** Plays the hero's decision, then runs the table back round to them. */
  act: (action: Action) => void;
  /** Books the finished hand and deals the next one. */
  nextHand: () => void;
  /** Starts a fresh session from the given config. */
  reset: (config?: SessionConfig) => void;
}

export const usePracticeStore = create<PracticeState>((set, get) => ({
  ...deal(DEFAULT_CONFIG),

  act: (action) => {
    const { hand, handSeats, heroSeat, opponents, botRng } = get();

    // A tap that arrives against a stale table is ignored rather than thrown:
    // `applyAction` is right to reject it, and the felt is wrong to crash on it.
    if (hand.complete || hand.toAct !== heroSeat || !isLegalAction(hand, action)) {
      return;
    }

    const played = playUntilSeat(applyAction(hand, action), heroSeat, opponents, botRng);

    set({ hand: played, reviews: gradeHero(played, handSeats, heroSeat) });
  },

  nextHand: () => {
    const { session, hand, handSeats, heroSeat, opponents, botRng, reviews, coachHistory } = get();

    if (!hand.complete) {
      return;
    }

    const record: HandCoachRecord = {
      handNumber: hand.handNumber,
      net: (hand.players[heroSeat]?.stack ?? 0) - (handSeats[heroSeat]?.stack ?? 0),
      reviews,
    };
    const booked = finishHand(session, hand);
    const { session: next, hand: dealt } = startNextHand(booked);
    const played = playUntilSeat(dealt, heroSeat, opponents, botRng);
    // From `next`, not `booked`: dealing is what tops a busted seat back up.
    const nextSeats = seatsOf(next);

    set({
      session: next,
      hand: played,
      handSeats: nextSeats,
      // The rare hand that finishes without the hero acting — all in from the
      // blind, say — still deserves its grades.
      reviews: gradeHero(played, nextSeats, heroSeat),
      coachHistory: [...coachHistory, record],
    });
  },

  reset: (config = DEFAULT_CONFIG) => set(deal(config)),
}));

/** Everything a fresh table needs: a session, its first hand, and the bots' turn. */
function deal(config: SessionConfig): Omit<PracticeState, 'act' | 'nextHand' | 'reset'> {
  const opened = startSession(config);
  const { session, hand } = startNextHand(opened);
  const botRng = createRng(config.seed ^ BOT_SEED_OFFSET);
  const played = playUntilSeat(hand, HERO_SEAT, OPPONENTS, botRng);
  const handSeats = seatsOf(session);

  return {
    session,
    hand: played,
    handSeats,
    heroSeat: HERO_SEAT,
    reviews: gradeHero(played, handSeats, HERO_SEAT),
    coachHistory: [],
    opponents: OPPONENTS,
    botRng,
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
