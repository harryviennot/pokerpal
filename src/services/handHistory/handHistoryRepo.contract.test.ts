/**
 * The repository contract, written once.
 *
 * Runs against the in-memory implementation under Jest. `sqliteRepo` promises
 * the same behavior and is exercised in the running app, where the native
 * module exists — the same posture the project log records for the formSheet.
 */

import { type DecisionFacts, type DecisionReview } from '@/engine';
import { playHand } from '@/fixtures/playedHand';

import { createMemoryHandHistoryRepo } from './memoryRepo';
import { PersistenceError, type HandHistoryRepo, type NewHandRecord } from './repo';

const FACTS: DecisionFacts = {
  street: 'preflop',
  playersBehind: 2,
  pot: 15,
  toCall: 10,
  stack: 1000,
  spr: 66.7,
  equity: 0.55,
  requiredEquity: 0.4,
  outs: 0,
};

function review(overrides: Partial<DecisionReview> = {}): DecisionReview {
  return {
    seat: 0,
    action: { type: 'call' },
    best: { type: 'call' },
    grade: 'correct',
    evLoss: 0,
    reason: 'Called 67% of pot with 55% equity, needing 40%.',
    leak: null,
    facts: FACTS,
    ...overrides,
  };
}

function hand(sessionId: number, overrides: Partial<NewHandRecord> = {}): NewHandRecord {
  const played = playHand(overrides.seed ?? 42);

  return {
    sessionId,
    handNumber: 1,
    playedAt: 1_000,
    seed: 42,
    button: 0,
    blinds: { smallBlind: 5, bigBlind: 10 },
    seats: played.seats,
    events: played.events,
    heroNet: -10,
    reviews: [review()],
    ...overrides,
  };
}

const SESSION = {
  startedAt: 500,
  style: 'cash',
  seed: 7,
  heroSeat: 0,
  blinds: { smallBlind: 5, bigBlind: 10 },
} as const;

function describeHandHistoryRepo(name: string, makeRepo: () => HandHistoryRepo): void {
  describe(name, () => {
    let repo: HandHistoryRepo;

    beforeEach(() => {
      repo = makeRepo();
    });

    it('hands out distinct session ids', async () => {
      const first = await repo.createSession(SESSION);
      const second = await repo.createSession(SESSION);

      expect(second).not.toBe(first);
    });

    it('stores a hand and lists it', async () => {
      const sessionId = await repo.createSession(SESSION);

      await repo.saveHand(hand(sessionId, { heroNet: 140, reviews: [review(), review()] }));

      const listed = await repo.listHands();

      expect(listed).toHaveLength(1);
      expect(listed[0]).toMatchObject({
        sessionId,
        handNumber: 1,
        playedAt: 1_000,
        heroNet: 140,
        decisionsGraded: 2,
        evLost: 0,
      });
    });

    it('lists newest first and respects the limit', async () => {
      const sessionId = await repo.createSession(SESSION);

      await repo.saveHand(hand(sessionId, { handNumber: 1, playedAt: 1_000 }));
      await repo.saveHand(hand(sessionId, { handNumber: 2, playedAt: 3_000 }));
      await repo.saveHand(hand(sessionId, { handNumber: 3, playedAt: 2_000 }));

      const listed = await repo.listHands();

      expect(listed.map((stored) => stored.handNumber)).toEqual([2, 3, 1]);
      expect(await repo.listHands({ limit: 2 })).toHaveLength(2);
    });

    it('ignores a second save of the same hand', async () => {
      const sessionId = await repo.createSession(SESSION);
      const record = hand(sessionId, { heroNet: 25 });

      await repo.saveHand(record);
      await repo.saveHand({ ...record, heroNet: 999 });

      const listed = await repo.listHands();

      expect(listed).toHaveLength(1);
      expect(listed[0]?.heroNet).toBe(25);
    });

    it('round-trips a hand whole: events, deck, seats and reviews', async () => {
      const sessionId = await repo.createSession(SESSION);
      const record = hand(sessionId, {
        reviews: [review(), review({ grade: 'mistake', evLoss: 30, leak: 'chasingWithoutOdds' })],
      });

      await repo.saveHand(record);

      const listed = await repo.listHands();
      const stored = await repo.getHand(listed[0]?.id ?? -1);

      expect(stored).not.toBeNull();
      expect(stored?.events).toEqual(record.events);
      expect(stored?.seats).toEqual(record.seats);
      expect(stored?.reviews).toEqual(record.reviews);
      expect(stored?.blinds).toEqual(record.blinds);
      expect(stored?.evLost).toBe(30);
      expect(stored?.heroSeat).toBe(SESSION.heroSeat);
    });

    it("reports the hero's seat from the hand's own session", async () => {
      // Two sessions with different hero seats: the only way to pass is to read
      // the seat off the session this hand belongs to. A hardcoded 0 fails, and
      // so does joining the wrong row.
      const first = await repo.createSession({ ...SESSION, heroSeat: 0 });
      const second = await repo.createSession({ ...SESSION, heroSeat: 2 });

      await repo.saveHand(hand(first, { handNumber: 1, playedAt: 1_000 }));
      await repo.saveHand(hand(second, { handNumber: 1, playedAt: 2_000 }));

      const listed = await repo.listHands();

      expect(await repo.getHand(listed[0]?.id ?? -1)).toMatchObject({ heroSeat: 2 });
      expect(await repo.getHand(listed[1]?.id ?? -1)).toMatchObject({ heroSeat: 0 });
    });

    it('returns null for a hand that does not exist', async () => {
      expect(await repo.getHand(999)).toBeNull();
    });

    it('adds up the totals', async () => {
      const sessionId = await repo.createSession(SESSION);

      await repo.saveHand(hand(sessionId, { handNumber: 1, heroNet: 140 }));
      await repo.saveHand(hand(sessionId, { handNumber: 2, heroNet: -45, reviews: [] }));

      expect(await repo.totals()).toEqual({ hands: 2, net: 95, decisionsGraded: 1 });
    });

    it('counts each session once, newest first', async () => {
      const early = await repo.createSession({ ...SESSION, startedAt: 100 });
      const late = await repo.createSession({ ...SESSION, startedAt: 900 });

      await repo.saveHand(
        hand(early, {
          handNumber: 1,
          heroNet: 40,
          reviews: [review(), review({ grade: 'blunder', evLoss: 30, leak: 'overBluffing' })],
        }),
      );
      await repo.saveHand(hand(early, { handNumber: 2, heroNet: -15, reviews: [] }));
      await repo.saveHand(hand(late, { handNumber: 1, heroNet: 5, reviews: [review()] }));

      const stats = await repo.listSessions();

      expect(stats.map((stat) => stat.sessionId)).toEqual([late, early]);
      // Two hands and two reviews: the net must not be counted once per review.
      expect(stats[1]).toMatchObject({
        startedAt: 100,
        hands: 2,
        net: 25,
        decisionsGraded: 2,
        mistakes: 1,
        evLost: 30,
      });
      expect(stats[0]).toMatchObject({ hands: 1, decisionsGraded: 1, mistakes: 0 });
    });

    it('leaves out a session that never stored a hand, and respects the limit', async () => {
      const used = await repo.createSession({ ...SESSION, startedAt: 100 });

      await repo.createSession({ ...SESSION, startedAt: 900 });
      await repo.saveHand(hand(used));

      expect((await repo.listSessions()).map((stat) => stat.sessionId)).toEqual([used]);
      expect(await repo.listSessions({ limit: 0 })).toEqual([]);
    });

    it('tallies every leak it has ever stored, costliest first', async () => {
      const sessionId = await repo.createSession(SESSION);

      await repo.saveHand(
        hand(sessionId, {
          handNumber: 1,
          reviews: [
            review({ grade: 'mistake', evLoss: 12, leak: 'chasingWithoutOdds' }),
            review({ grade: 'mistake', evLoss: 40, leak: 'preflopLooseness' }),
            review(),
          ],
        }),
      );
      await repo.saveHand(
        hand(sessionId, {
          handNumber: 2,
          reviews: [review({ grade: 'blunder', evLoss: 8, leak: 'chasingWithoutOdds' })],
        }),
      );

      expect(await repo.leakTotals()).toEqual([
        { leak: 'preflopLooseness', count: 1, evLoss: 40 },
        { leak: 'chasingWithoutOdds', count: 2, evLoss: 20 },
      ]);
    });

    it('starts empty', async () => {
      expect(await repo.listHands()).toEqual([]);
      expect(await repo.totals()).toEqual({ hands: 0, net: 0, decisionsGraded: 0 });
      expect(await repo.listSessions()).toEqual([]);
      expect(await repo.leakTotals()).toEqual([]);
    });

    it('refuses a hand for a session it has never seen', async () => {
      await expect(repo.saveHand(hand(41))).rejects.toThrow(PersistenceError);
    });
  });
}

describeHandHistoryRepo('memoryRepo', createMemoryHandHistoryRepo);
