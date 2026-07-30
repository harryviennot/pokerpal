import { HandArchiver, type ArchivedHand } from './archiver';
import { createMemoryHandHistoryRepo } from './memoryRepo';
import { type HandHistoryRepo, PersistenceError } from './repo';

const META = {
  style: 'cash',
  seed: 7,
  heroSeat: 0,
  blinds: { smallBlind: 5, bigBlind: 10 },
} as const;

function archived(handNumber: number): ArchivedHand {
  return {
    handNumber,
    seed: 42,
    button: 0,
    blinds: { smallBlind: 5, bigBlind: 10 },
    seats: [{ id: 'You', stack: 1000 }],
    events: [],
    heroNet: -10,
    reviews: [],
  };
}

describe('HandArchiver', () => {
  it('creates the session lazily and writes hands in order', async () => {
    const repo = createMemoryHandHistoryRepo();
    const statuses: string[] = [];
    const archiver = new HandArchiver(
      () => Promise.resolve(repo),
      META,
      (status) => statuses.push(status),
      () => 1_000,
    );

    archiver.recordHand(archived(1));
    archiver.recordHand(archived(2));
    await archiver.idle();

    const listed = await repo.listHands();

    expect(listed.map((hand) => hand.handNumber).sort()).toEqual([1, 2]);
    // Both hands share the one lazily created session.
    expect(new Set(listed.map((hand) => hand.sessionId)).size).toBe(1);
    expect(statuses).toEqual(['ok', 'ok']);
  });

  it('does zero I/O until the first hand is recorded', async () => {
    let opened = 0;
    const archiver = new HandArchiver(
      () => {
        opened += 1;

        return Promise.resolve(createMemoryHandHistoryRepo());
      },
      META,
      () => undefined,
    );

    await archiver.idle();

    expect(opened).toBe(0);

    archiver.recordHand(archived(1));
    await archiver.idle();

    expect(opened).toBe(1);
  });

  it('saves a double-recorded hand once', async () => {
    const repo = createMemoryHandHistoryRepo();
    const archiver = new HandArchiver(
      () => Promise.resolve(repo),
      META,
      () => undefined,
    );

    archiver.recordHand(archived(3));
    archiver.recordHand(archived(3));
    await archiver.idle();

    expect(await repo.listHands()).toHaveLength(1);
  });

  it('reports no session until a hand has been written, then the one it wrote to', async () => {
    const repo = createMemoryHandHistoryRepo();
    let created = 0;
    const counting: HandHistoryRepo = {
      ...repo,
      createSession: (session) => {
        created += 1;

        return repo.createSession(session);
      },
    };
    const archiver = new HandArchiver(
      () => Promise.resolve(counting),
      META,
      () => undefined,
      () => 1_000,
    );

    expect(await archiver.currentSessionId()).toBeNull();
    // Asking must not be what creates the row.
    expect(created).toBe(0);

    archiver.recordHand(archived(1));
    await archiver.idle();

    const [stored] = await repo.listHands();

    expect(stored).toBeDefined();
    expect(await archiver.currentSessionId()).toBe(stored?.sessionId);
    expect(created).toBe(1);
  });

  it('reports no session when the session row failed to write', async () => {
    const repo = createMemoryHandHistoryRepo();
    const flaky: HandHistoryRepo = {
      ...repo,
      createSession: () => Promise.reject(new PersistenceError('write', 'Disk on fire.')),
    };
    const statuses: string[] = [];
    const archiver = new HandArchiver(
      () => Promise.resolve(flaky),
      META,
      (status) => statuses.push(status),
    );

    archiver.recordHand(archived(1));
    await archiver.idle();

    // The failure already reached the feature boundary once, through onStatus.
    // Asking which session the hands went to must not throw it a second time.
    expect(statuses).toEqual(['error']);
    expect(await archiver.currentSessionId()).toBeNull();
  });

  it('reports each failure and keeps the queue alive', async () => {
    const repo = createMemoryHandHistoryRepo();
    let failNext = true;
    const flaky: HandHistoryRepo = {
      ...repo,
      saveHand: (hand) => {
        if (failNext) {
          failNext = false;

          return Promise.reject(new PersistenceError('write', 'Disk on fire.'));
        }

        return repo.saveHand(hand);
      },
    };
    const statuses: string[] = [];
    const archiver = new HandArchiver(
      () => Promise.resolve(flaky),
      META,
      (status) => statuses.push(status),
    );

    archiver.recordHand(archived(1));
    archiver.recordHand(archived(2));
    await archiver.idle();

    expect(statuses).toEqual(['error', 'ok']);
    expect((await repo.listHands()).map((hand) => hand.handNumber)).toEqual([2]);
  });

  it('retries the session row after it failed once', async () => {
    const repo = createMemoryHandHistoryRepo();
    let failSession = true;
    const flaky: HandHistoryRepo = {
      ...repo,
      createSession: (session) => {
        if (failSession) {
          failSession = false;

          return Promise.reject(new PersistenceError('write', 'Disk on fire.'));
        }

        return repo.createSession(session);
      },
    };
    const statuses: string[] = [];
    const archiver = new HandArchiver(
      () => Promise.resolve(flaky),
      META,
      (status) => statuses.push(status),
    );

    archiver.recordHand(archived(1));
    await archiver.idle();
    archiver.recordHand(archived(2));
    await archiver.idle();

    expect(statuses).toEqual(['error', 'ok']);
    expect((await repo.listHands()).map((hand) => hand.handNumber)).toEqual([2]);
  });
});
