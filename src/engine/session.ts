/**
 * The table between hands.
 *
 * `hand.ts` knows how to play one hand and nothing else. This is what moves the
 * button, raises the blinds, carries stacks forward, busts players out and
 * decides whether there is another hand to play — the difference between a
 * hand of poker and a session of it.
 *
 * Two styles, per the PRD: a cash game where a busted player can rebuy and the
 * session runs until the player stops, and a sit-and-go that ends when one
 * player holds every chip.
 */

import { createDeck, shuffle } from './deck';
import { type HandEvent } from './events';
import { dealHand } from './hand';
import { createRng, type Rng } from './rng';
import { InvalidTableError, type HandState, type SeatIndex, type TableConfig } from './table';

export type TableStyle = 'cash' | 'sitAndGo';

export interface BlindLevel {
  smallBlind: number;
  bigBlind: number;
  ante?: number;
}

export interface SessionConfig {
  seats: readonly { id: string; stack: number }[];
  style: TableStyle;
  /** Played in order; the last level runs forever once reached. */
  levels: readonly BlindLevel[];
  /** Hands played per level. Omit for a cash game that never raises blinds. */
  handsPerLevel?: number;
  button?: SeatIndex;
  seed: number;
  /** Cash only: chips a busted player buys back in for. Omit to let them bust. */
  rebuyTo?: number;
}

export interface SessionSeat {
  id: string;
  stack: number;
  /** False once busted with no rebuy; the seat keeps its index for the log. */
  seated: boolean;
}

/** One finished hand, kept for replay and the coach. */
export interface HandRecord {
  handNumber: number;
  seed: number;
  button: SeatIndex;
  blinds: BlindLevel;
  events: readonly HandEvent[];
  /** Net chips won or lost per seat, in seat order. */
  results: readonly number[];
}

export interface SessionState {
  style: TableStyle;
  seats: readonly SessionSeat[];
  levels: readonly BlindLevel[];
  handsPerLevel: number | null;
  level: number;
  button: SeatIndex;
  handsPlayed: number;
  history: readonly HandRecord[];
  rebuyTo: number | null;
  /** Drawn from here so each hand gets its own reproducible seed. */
  rng: Rng;
  over: boolean;
}

const MIN_PLAYERS = 2;

export function startSession(config: SessionConfig): SessionState {
  if (config.levels.length === 0) {
    throw new InvalidTableError('A session needs at least one blind level.');
  }

  if (config.seats.length < MIN_PLAYERS) {
    throw new InvalidTableError(`A session needs at least ${MIN_PLAYERS} seats.`);
  }

  const seats = config.seats.map((seat) => ({ ...seat, seated: seat.stack > 0 }));

  return {
    style: config.style,
    seats,
    levels: config.levels,
    handsPerLevel: config.handsPerLevel ?? null,
    level: 0,
    // The button starts *behind* the first dealer so the first `startNextHand`
    // moves it onto them, keeping one rule for every hand.
    button: config.button ?? seats.length - 1,
    handsPlayed: 0,
    history: [],
    rebuyTo: config.rebuyTo ?? null,
    rng: createRng(config.seed),
    over: seats.filter((seat) => seat.seated).length < MIN_PLAYERS,
  };
}

export function currentBlinds(session: SessionState): BlindLevel {
  const index = Math.min(session.level, session.levels.length - 1);

  return session.levels[index] as BlindLevel;
}

/**
 * Moves the session to `level`, clamped to the ladder; never moves backwards.
 *
 * The seam for a wall clock. `handsPerLevel` counts hands, which is the wrong
 * unit for a tournament that raises blinds every three minutes: a timer above
 * the engine works out which level the session is on and states it here. Both
 * are safe together — whichever is further up the ladder wins, because this
 * never goes back down.
 *
 * Clamping rather than throwing is the point: a clock that has run past the last
 * level is how every long session ends, not an error. The same session comes
 * back by identity when there is nothing to do, so a driver ticking every second
 * allocates nothing and re-renders nothing.
 */
export function advanceToLevel(session: SessionState, level: number): SessionState {
  // A non-finite level would sail through the clamp and leave `currentBlinds`
  // indexing the ladder with NaN, which reads as blinds that do not exist.
  const wanted = Number.isFinite(level) ? Math.floor(level) : session.level;
  const next = Math.min(Math.max(wanted, session.level), session.levels.length - 1);

  return next === session.level ? session : { ...session, level: next };
}

/**
 * Deals the next hand: rebuys where allowed, moves the button, applies the
 * current blind level and returns the session alongside the live hand.
 *
 * @throws {InvalidTableError} when the session is over or too few players remain.
 */
export function startNextHand(session: SessionState): { session: SessionState; hand: HandState } {
  if (session.over) {
    throw new InvalidTableError('The session is over.');
  }

  const seats = session.rebuyTo === null ? session.seats : rebuy(session.seats, session.rebuyTo);
  const playable = seats.filter((seat) => seat.seated && seat.stack > 0);

  if (playable.length < MIN_PLAYERS) {
    throw new InvalidTableError(`Only ${playable.length} player(s) can be dealt in.`);
  }

  const button = nextButton(seats, session.button);
  const blinds = currentBlinds(session);
  const seed = session.rng.nextUint32();

  const config: TableConfig = {
    // Busted seats stay in the array so seat indexes never shift under the UI;
    // a zero stack is what marks them as not dealt in.
    seats: seats.map((seat) => ({ id: seat.id, stack: seat.seated ? seat.stack : 0 })),
    button,
    blinds,
    handNumber: session.handsPlayed + 1,
    seed,
  };

  const hand = dealHand(config, shuffle(createDeck(), createRng(seed)));

  return { session: { ...session, seats, button }, hand };
}

/**
 * Folds a finished hand back into the session: writes stacks back, records the
 * hand, advances the blind level and works out whether to keep playing.
 *
 * @throws {InvalidTableError} when the hand has not finished.
 */
export function finishHand(session: SessionState, hand: HandState): SessionState {
  if (!hand.complete) {
    throw new InvalidTableError('That hand is still in progress.');
  }

  const results = hand.players.map(
    (player, index) => player.stack - (session.seats[index]?.stack ?? 0),
  );

  const seats = session.seats.map((seat, index) => {
    const stack = hand.players[index]?.stack ?? seat.stack;

    return { ...seat, stack, seated: seat.seated && (stack > 0 || session.rebuyTo !== null) };
  });

  const handsPlayed = session.handsPlayed + 1;
  const record: HandRecord = {
    handNumber: hand.handNumber,
    seed: hand.seed,
    button: hand.button,
    blinds: hand.blinds,
    events: hand.events,
    results,
  };

  const level =
    session.handsPerLevel !== null && handsPlayed % session.handsPerLevel === 0
      ? Math.min(session.level + 1, session.levels.length - 1)
      : session.level;

  const withChips = seats.filter((seat) => seat.seated && seat.stack > 0);

  return {
    ...session,
    seats,
    level,
    handsPlayed,
    history: [...session.history, record],
    // A cash game only ends when the player leaves; a sit-and-go ends when one
    // player has everything.
    over: session.rebuyTo !== null ? false : withChips.length < MIN_PLAYERS,
  };
}

export function isSessionOver(session: SessionState): boolean {
  return session.over;
}

/** The winner of a finished sit-and-go, or null while it is still running. */
export function sessionWinner(session: SessionState): SessionSeat | null {
  if (!session.over) {
    return null;
  }

  return session.seats.find((seat) => seat.stack > 0) ?? null;
}

/** Tops a busted seat back up. Cash games only; a sit-and-go passes no amount. */
function rebuy(seats: readonly SessionSeat[], to: number): SessionSeat[] {
  return seats.map((seat) => (seat.seated && seat.stack === 0 ? { ...seat, stack: to } : seat));
}

/**
 * Moves the button one seat clockwise, skipping seats with no chips.
 *
 * This is the forward-moving button: simple, always legal, and it avoids the
 * dead-button bookkeeping that only matters in a cardroom. A player can post
 * the big blind twice in a row when the seat behind them busts, which is the
 * accepted trade in online play.
 */
function nextButton(seats: readonly SessionSeat[], button: SeatIndex): SeatIndex {
  for (let step = 1; step <= seats.length; step++) {
    const seat = (button + step) % seats.length;
    const candidate = seats[seat];

    if (candidate?.seated && candidate.stack > 0) {
      return seat;
    }
  }

  return button;
}
