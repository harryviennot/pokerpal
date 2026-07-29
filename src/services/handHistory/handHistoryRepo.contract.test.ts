/**
 * The repository contract, written once.
 *
 * Runs against the in-memory implementation under Jest. `sqliteRepo` promises
 * the same behavior and is exercised in the running app, where the native
 * module exists — the same posture the project log records for the formSheet.
 */

import {
  applyAction,
  createRng,
  legalActions,
  startHand,
  type Action,
  type DecisionFacts,
  type DecisionReview,
  type HandEvent,
} from '@/engine';

import { createMemoryHandHistoryRepo } from './memoryRepo';
import { PersistenceError, type HandHistoryRepo, type NewHandRecord } from './repo';

/** A real hand played through the engine, so events round-trip deck and all. */
function playHand(seed: number): readonly HandEvent[] {
  let state = startHand(
    {
      seats: [
        { id: 'You', stack: 1000 },
        { id: 'Ava', stack: 1000 },
        { id: 'Ben', stack: 1000 },
      ],
      button: 0,
      blinds: { smallBlind: 5, bigBlind: 10 },
      handNumber: 1,
      seed,
    },
    createRng(seed),
  );

  for (let step = 0; step < 200 && !state.complete; step++) {
    state = applyAction(state, firstLegal(state));
  }

  return state.events;
}

function firstLegal(state: Parameters<typeof legalActions>[0]): Action {
  const legal = legalActions(state)[0];

  if (!legal) {
    throw new Error('A live hand must offer an action.');
  }

  switch (legal.type) {
    case 'bet':
      return { type: 'bet', to: legal.min };
    case 'raise':
      return { type: 'raise', to: legal.min };
    default:
      return { type: legal.type };
  }
}

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
  return {
    sessionId,
    handNumber: 1,
    playedAt: 1_000,
    seed: 42,
    button: 0,
    blinds: { smallBlind: 5, bigBlind: 10 },
    seats: [
      { id: 'You', stack: 1000 },
      { id: 'Ava', stack: 1000 },
      { id: 'Ben', stack: 1000 },
    ],
    events: playHand(overrides.seed ?? 42),
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

    it('starts empty', async () => {
      expect(await repo.listHands()).toEqual([]);
      expect(await repo.totals()).toEqual({ hands: 0, net: 0, decisionsGraded: 0 });
    });

    it('refuses a hand for a session it has never seen', async () => {
      await expect(repo.saveHand(hand(41))).rejects.toThrow(PersistenceError);
    });
  });
}

describeHandHistoryRepo('memoryRepo', createMemoryHandHistoryRepo);
