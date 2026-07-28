import { create } from 'zustand';

import {
  alwaysCall,
  applyAction,
  createRng,
  finishHand,
  isLegalAction,
  playUntilSeat,
  startNextHand,
  startSession,
  type Action,
  type BotPolicy,
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
 * Six-handed, 5/10, rebuys on. A cash game that never ends is the right default
 * for practice: the player leaves when they want to, not when they bust.
 * Configuring any of this is a later slice.
 */
const DEFAULT_CONFIG: SessionConfig = {
  seats: [
    { id: 'You', stack: STARTING_STACK },
    { id: 'Ava', stack: STARTING_STACK },
    { id: 'Ben', stack: STARTING_STACK },
    { id: 'Cleo', stack: STARTING_STACK },
    { id: 'Dev', stack: STARTING_STACK },
    { id: 'Elle', stack: STARTING_STACK },
  ],
  style: 'cash',
  levels: [{ smallBlind: 5, bigBlind: 10 }],
  rebuyTo: STARTING_STACK,
  seed: 20260728,
};

export interface PracticeState {
  session: SessionState;
  hand: HandState;
  /** Stacks as they were when this hand was dealt, which replay needs. */
  handSeats: readonly { id: string; stack: number }[];
  heroSeat: SeatIndex;
  /**
   * What the other five seats do. A calling station until the archetypes land —
   * deliberately the PRD's own baseline rather than an invented placeholder.
   */
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
    const { hand, heroSeat, opponents, botRng } = get();

    // A tap that arrives against a stale table is ignored rather than thrown:
    // `applyAction` is right to reject it, and the felt is wrong to crash on it.
    if (hand.complete || hand.toAct !== heroSeat || !isLegalAction(hand, action)) {
      return;
    }

    set({ hand: playUntilSeat(applyAction(hand, action), heroSeat, opponents, botRng) });
  },

  nextHand: () => {
    const { session, hand, heroSeat, opponents, botRng } = get();

    if (!hand.complete) {
      return;
    }

    const booked = finishHand(session, hand);
    const { session: next, hand: dealt } = startNextHand(booked);

    set({
      session: next,
      hand: playUntilSeat(dealt, heroSeat, opponents, botRng),
      // From `next`, not `booked`: dealing is what tops a busted seat back up.
      handSeats: seatsOf(next),
    });
  },

  reset: (config = DEFAULT_CONFIG) => set(deal(config)),
}));

/** Everything a fresh table needs: a session, its first hand, and the bots' turn. */
function deal(config: SessionConfig): Omit<PracticeState, 'act' | 'nextHand' | 'reset'> {
  const opened = startSession(config);
  const { session, hand } = startNextHand(opened);
  const botRng = createRng(config.seed ^ BOT_SEED_OFFSET);

  return {
    session,
    hand: playUntilSeat(hand, HERO_SEAT, alwaysCall, botRng),
    handSeats: seatsOf(session),
    heroSeat: HERO_SEAT,
    opponents: alwaysCall,
    botRng,
  };
}

/**
 * The stacks a hand is about to be dealt from. Taken before the deal, because
 * once blinds are posted the players' stacks no longer say what they started on.
 */
function seatsOf(session: SessionState): readonly { id: string; stack: number }[] {
  return session.seats.map((seat) => ({ id: seat.id, stack: seat.seated ? seat.stack : 0 }));
}
