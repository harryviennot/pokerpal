/**
 * The write queue between a synchronous game and an asynchronous disk.
 *
 * `recordHand` returns void on purpose: the table must never wait on storage,
 * and the no-floating-promises rule is satisfied structurally because the
 * promise chain lives inside the archiver rather than at any call site. Writes
 * are strictly ordered on one internal tail, and the session row is created
 * lazily by the first hand's write, so a hand can never race its own session.
 */

import {
  type Blinds,
  type DecisionReview,
  type HandEvent,
  type SeatIndex,
  type TableStyle,
} from '@/engine';

import { type HandHistoryRepo, type SessionId } from './repo';

export interface SessionMeta {
  style: TableStyle;
  seed: number;
  heroSeat: SeatIndex;
  blinds: Blinds;
}

export interface ArchivedHand {
  handNumber: number;
  seed: number;
  button: SeatIndex;
  blinds: Blinds;
  seats: readonly { id: string; stack: number }[];
  events: readonly HandEvent[];
  heroNet: number;
  reviews: readonly DecisionReview[];
}

export class HandArchiver {
  private tail: Promise<void> = Promise.resolve();
  private sessionId: Promise<SessionId> | null = null;

  constructor(
    private readonly repo: () => Promise<HandHistoryRepo>,
    private readonly meta: SessionMeta,
    /** The feature boundary: every write reports ok or error through here. */
    private readonly onStatus: (status: 'ok' | 'error') => void,
    private readonly now: () => number = Date.now,
  ) {}

  /** Enqueues the hand. Double-saving a hand number is a repository no-op. */
  recordHand(hand: ArchivedHand): void {
    this.tail = this.tail
      .then(async () => {
        const repo = await this.repo();
        const sessionId = await this.session(repo);

        await repo.saveHand({
          sessionId,
          handNumber: hand.handNumber,
          playedAt: this.now(),
          seed: hand.seed,
          button: hand.button,
          blinds: hand.blinds,
          seats: hand.seats,
          events: hand.events,
          heroNet: hand.heroNet,
          reviews: hand.reviews,
        });
        this.onStatus('ok');
      })
      .catch(() => {
        // The failure is not swallowed: it is delivered to the feature
        // boundary, and the queue stays alive for the hands after it.
        this.onStatus('error');
      });
  }

  /** Resolves when every enqueued write has settled. Tests drain on this. */
  idle(): Promise<void> {
    return this.tail;
  }

  /**
   * The session row this archiver's hands are attached to, or null when there
   * is not one yet.
   *
   * Answers the question, it does not force it: the row appears on the first
   * hand's write, and a summary screen asking which session to read must not be
   * the thing that conjures an empty one. Callers wanting the id for hands they
   * have just recorded await `idle()` first. A session insert that failed also
   * reads as null — the failure already reached the feature boundary through
   * `onStatus`, and it must not surface a second time as a rejected promise.
   */
  currentSessionId(): Promise<SessionId | null> {
    return this.sessionId?.catch(() => null) ?? Promise.resolve(null);
  }

  private session(repo: HandHistoryRepo): Promise<SessionId> {
    // A failed session insert clears the memo so the next hand retries it —
    // one transient failure must not strand the whole session's history.
    this.sessionId ??= repo
      .createSession({
        startedAt: this.now(),
        style: this.meta.style,
        seed: this.meta.seed,
        heroSeat: this.meta.heroSeat,
        blinds: this.meta.blinds,
      })
      .catch((error: unknown) => {
        this.sessionId = null;
        throw error;
      });

    return this.sessionId;
  }
}
