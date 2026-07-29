/**
 * The repository contract on plain arrays.
 *
 * Behaviorally identical to `sqliteRepo` — the contract tests run against this
 * implementation — with no I/O and no native module, so it serves every Jest
 * test and any future preview screen.
 */

import {
  PersistenceError,
  type HandHistoryRepo,
  type NewHandRecord,
  type NewSessionRecord,
  type SessionId,
  type StoredHand,
  type StoredHandSummary,
} from './repo';

interface MemoryHand extends NewHandRecord {
  id: number;
}

export function createMemoryHandHistoryRepo(): HandHistoryRepo {
  const sessions = new Map<SessionId, NewSessionRecord>();
  const hands: MemoryHand[] = [];
  let nextSessionId = 1;
  let nextHandId = 1;

  const summarize = (hand: MemoryHand): StoredHandSummary => ({
    id: hand.id,
    sessionId: hand.sessionId,
    handNumber: hand.handNumber,
    playedAt: hand.playedAt,
    heroNet: hand.heroNet,
    decisionsGraded: hand.reviews.length,
    evLost: hand.reviews.reduce((sum, review) => sum + review.evLoss, 0),
  });

  return {
    createSession(session) {
      const id = nextSessionId++;

      sessions.set(id, session);

      return Promise.resolve(id);
    },

    saveHand(hand) {
      if (!sessions.has(hand.sessionId)) {
        return Promise.reject(
          new PersistenceError('write', `No session ${hand.sessionId} to attach the hand to.`),
        );
      }

      const duplicate = hands.some(
        (stored) => stored.sessionId === hand.sessionId && stored.handNumber === hand.handNumber,
      );

      if (!duplicate) {
        hands.push({ ...hand, id: nextHandId++ });
      }

      return Promise.resolve();
    },

    listHands(options) {
      const newestFirst = [...hands]
        .sort((a, b) => b.playedAt - a.playedAt || b.id - a.id)
        .map(summarize);

      return Promise.resolve(
        options?.limit === undefined ? newestFirst : newestFirst.slice(0, options.limit),
      );
    },

    getHand(id) {
      const hand = hands.find((stored) => stored.id === id);

      if (!hand) {
        return Promise.resolve<StoredHand | null>(null);
      }

      const session = sessions.get(hand.sessionId);

      // Unreachable — `saveHand` refuses a hand with no session — but the hero's
      // seat is not something to default. A felt rotated to a guessed seat is
      // wrong in a way nobody would notice.
      if (!session) {
        return Promise.reject(
          new PersistenceError('read', `Hand ${id} has no session ${hand.sessionId}.`),
        );
      }

      return Promise.resolve({
        ...summarize(hand),
        seed: hand.seed,
        button: hand.button,
        heroSeat: session.heroSeat,
        blinds: hand.blinds,
        seats: hand.seats,
        events: hand.events,
        reviews: hand.reviews,
      });
    },

    totals() {
      return Promise.resolve(
        hands.reduce(
          (sum, hand) => ({
            hands: sum.hands + 1,
            net: sum.net + hand.heroNet,
            decisionsGraded: sum.decisionsGraded + hand.reviews.length,
          }),
          { hands: 0, net: 0, decisionsGraded: 0 },
        ),
      );
    },
  };
}
