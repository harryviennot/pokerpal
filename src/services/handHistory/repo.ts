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
  totals(): Promise<HandHistoryTotals>;
}
