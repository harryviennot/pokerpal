/**
 * The hand-history repository: what the app remembers after the app is gone.
 *
 * A thin contract over storage. `sqliteRepo` implements it on the device,
 * `memoryRepo` implements it for tests and previews, and everything above this
 * file is indifferent to which one it is talking to.
 */

import {
  type Blinds,
  type DecisionReview,
  type HandEvent,
  type LeakTally,
  type SeatIndex,
  type TableStyle,
} from '@/engine';

export type SessionId = number;

export interface NewSessionRecord {
  /** Milliseconds since the epoch, supplied by the caller's clock. */
  startedAt: number;
  style: TableStyle;
  seed: number;
  heroSeat: SeatIndex;
  blinds: Blinds;
}

export interface NewHandRecord {
  sessionId: SessionId;
  handNumber: number;
  /** Milliseconds since the epoch, when the hand completed. */
  playedAt: number;
  seed: number;
  button: SeatIndex;
  blinds: Blinds;
  /** Stacks as the hand was dealt from them, which replay needs. */
  seats: readonly { id: string; stack: number }[];
  /** The full event log, shuffled deck included — the hand itself. */
  events: readonly HandEvent[];
  /** The hero's chips won or lost on the hand. */
  heroNet: number;
  reviews: readonly DecisionReview[];
}

/** One row of the history list: enough to show, not enough to replay. */
export interface StoredHandSummary {
  id: number;
  sessionId: SessionId;
  handNumber: number;
  playedAt: number;
  heroNet: number;
  decisionsGraded: number;
  /** Chips of expected value given up across the hand's graded decisions. */
  evLost: number;
}

export interface StoredHand extends StoredHandSummary {
  seed: number;
  button: SeatIndex;
  /**
   * The seat the player occupied, taken from the hand's own session. The felt
   * rotates to it and turns its cards face up, so a hand cannot be replayed
   * without it.
   */
  heroSeat: SeatIndex;
  blinds: Blinds;
  seats: readonly { id: string; stack: number }[];
  events: readonly HandEvent[];
  reviews: readonly DecisionReview[];
}

export interface HandHistoryTotals {
  hands: number;
  net: number;
  decisionsGraded: number;
}

/**
 * One session's play, counted rather than fetched.
 *
 * The session is the trend's x-axis on purpose: it is a unit the player
 * recognises ("last night"), and bucketing by calendar day would have to pick a
 * timezone in SQL that the labels are then formatted in on the device.
 */
export interface StoredSessionStat {
  sessionId: SessionId;
  startedAt: number;
  hands: number;
  net: number;
  decisionsGraded: number;
  /** Decisions graded `mistake` or `blunder`. */
  mistakes: number;
  evLost: number;
}

export type PersistenceOp = 'open' | 'migrate' | 'read' | 'write';

/** Every storage failure crosses this boundary as one typed error. */
export class PersistenceError extends Error {
  constructor(
    readonly op: PersistenceOp,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'PersistenceError';
  }
}

export interface HandHistoryRepo {
  createSession(session: NewSessionRecord): Promise<SessionId>;
  /** Idempotent on (sessionId, handNumber): saving the same hand twice is a no-op. */
  saveHand(hand: NewHandRecord): Promise<void>;
  /** Newest first. */
  listHands(options?: { limit?: number }): Promise<readonly StoredHandSummary[]>;
  getHand(id: number): Promise<StoredHand | null>;
  /**
   * One session's hands, oldest first by hand number.
   *
   * Ascending, unlike `listHands`: this answers "how did that session go", and
   * the post-game summary needs the stored row ids to link its best and worst
   * hand to the replay. An unknown session is empty, not an error.
   */
  listSessionHands(sessionId: SessionId): Promise<readonly StoredHandSummary[]>;
  totals(): Promise<HandHistoryTotals>;
  /** Newest first. Sessions that never stored a hand are left out. */
  listSessions(options?: { limit?: number }): Promise<readonly StoredSessionStat[]>;
  /** Every habit the coach has ever charged the player for, costliest first. */
  leakTotals(): Promise<readonly LeakTally[]>;
}
