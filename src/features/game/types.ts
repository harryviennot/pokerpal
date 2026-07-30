/**
 * The shape of a game in progress: the contract between the store and the felt.
 *
 * Types only, no implementation. The store, the table, the game chrome and the
 * summary are being built against this file in parallel, so it is the one place
 * that says what a game *is* — and changing a field here changes four screens.
 */

import {
  type Action,
  type DecisionReview,
  type HandState,
  type SeatIndex,
  type SessionState,
} from '@/engine';
import { type SessionId } from '@/services/handHistory';

import { type GameSetup } from './tableSetup';

/**
 * `GameSetup` has moved into `tableSetup.ts`, next to the rest of the setup
 * vocabulary, and is re-exported here so the contract still reads as one file.
 * Type-only both ways, so the two modules naming each other costs nothing at
 * runtime.
 */
export { type GameSetup };

/**
 * Learning shows the coach's read as you play; real hides it until the session
 * is over. Same engine, same bots — the only difference is what you are told
 * and when, because being graded mid-hand changes how you play the next street.
 */
export type GameMode = 'learning' | 'real';

/**
 * Where the hand is, from the player's point of view rather than the engine's.
 *
 * The engine only knows whose turn it is; these are the states the screen has to
 * distinguish to pace itself — cards still flying, a bot pretending to think, a
 * hero on the clock, a hand that is over but still on screen.
 */
export type GamePhase =
  'dealing' | 'revealing' | 'botThinking' | 'heroTurn' | 'handOver' | 'sessionOver';

/** An action armed before it is the hero's turn, so a fast table stays playable. */
export type Preselect = 'checkFold' | 'check' | 'callAny';

/** The coach's word on the hand just finished, waiting to be dismissed. */
export interface AdviceNotice {
  handNumber: number;
  net: number;
  total: number;
  review: DecisionReview | null;
}

/** One hand's worth of grading, kept so the session review can look back. */
export interface HandCoachRecord {
  handNumber: number;
  net: number;
  reviews: readonly DecisionReview[];
}

/** What the summary screen needs, captured at the moment the session ended. */
export interface SessionSummaryData {
  hands: number;
  net: number;
  endedAt: number;
  startedAt: number;
  busted: boolean;
}

export interface ActiveGame {
  /** Chosen at the lobby and fixed for the session: switching mid-session would rewrite history. */
  mode: GameMode;
  /** The engine's session: stacks, blind level, hands played. */
  session: SessionState;
  /** The engine's current hand. The single source of truth for what is legal. */
  hand: HandState;
  /** Stacks as they stood when the hand was dealt, so net-for-the-hand is derivable. */
  handSeats: readonly { id: string; stack: number }[];
  /** Which seat is the player. Not always zero once the button moves. */
  heroSeat: SeatIndex;
  /** Index into `AVATARS` per seat, drawn once per session so faces do not shuffle between hands. */
  avatars: readonly number[];
  /** What the screen is currently doing. Drives pacing, not rules. */
  phase: GamePhase;
  /**
   * How many of `hand.events` have been shown. Lags the engine, which resolves a
   * street or a showdown in one burst, so the felt renders the prefix
   * `hand.events.slice(0, shown)` and the cards and chips arrive one at a time.
   */
  shown: number;
  /** The hero's armed action, cleared the moment it is spent or invalidated. */
  preselect: Preselect | null;
  /** Grades for the hand in progress. */
  reviews: readonly DecisionReview[];
  /** Grades for the hands already finished, newest last. */
  coachHistory: readonly HandCoachRecord[];
  /** The notice on screen now, or null. Learning mode only. */
  advice: AdviceNotice | null;
  /** Hero equity per remaining runout, or null when it is not being shown or not yet computed. */
  runoutEquity: readonly (number | null)[] | null;
  /** Whether the last archive write succeeded. A failed save must not stop the game. */
  saveState: 'ok' | 'error';
  /** Epoch ms the session began, for the summary's duration. */
  startedAt: number;
  /** Epoch ms the hero's clock runs out, or null when they are not on it. */
  decisionDeadline: number | null;
  /** Set once, when the session ends. Non-null is what sends the player to the summary. */
  sessionEnd: SessionSummaryData | null;
}

export interface GameState {
  /** The lobby's draft, kept between sessions so the table you like is one tap away. */
  setup: GameSetup;
  /** Null between sessions: no game is a state, not an empty game. */
  game: ActiveGame | null;
  /** Seats the table and deals the first hand. `seed` is for tests and replays. */
  start(setup: GameSetup, seed?: number): void;
  /** The hero acts. Illegal actions are the store's problem to reject, not the screen's. */
  act(action: Action): void;
  setPreselect(p: Preselect | null): void;
  dismissAdvice(): void;
  /** Ends the session and clears `game`. */
  leave(): void;
  /**
   * Resolves once every hand archived so far has reached the disk.
   *
   * A test seam, not a screen's business: the game never waits on storage, so
   * nothing on the felt has anything to await. Tests that assert a hand was
   * saved need somewhere to hang the wait, and this is it.
   */
  archiveIdle(): Promise<void>;
  /**
   * The stored session row this game's hands were written to, or null when the
   * disk has nothing for it.
   *
   * The summary knows hand numbers and the replay route needs database ids, so
   * something has to bridge the two; the archiver that knows the mapping is the
   * store's private business, and this is the one question worth asking it.
   * Never creates the row — a summary asking which session to read must not be
   * the thing that conjures an empty one — so callers `await archiveIdle()`
   * first or they will ask before the first write has made it.
   */
  storedSessionId(): Promise<SessionId | null>;
}
