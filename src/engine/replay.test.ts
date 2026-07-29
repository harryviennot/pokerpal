import { legalActions } from './betting';
import { type DecisionFacts, type DecisionReview } from './coach';
import { type SeatIndex } from './events';
import { applyAction, startHand } from './hand';
import {
  replayHand,
  reviewsByFrame,
  snapshotPot,
  snapshotToCall,
  type ReplayFrame,
} from './replay';
import { createRng, type Rng } from './rng';
import { type Action, type HandState, type LegalAction, type TableConfig } from './table';

const SEATS = [
  { id: 'Ava', stack: 1000 },
  { id: 'Ben', stack: 1000 },
  { id: 'Cleo', stack: 1000 },
];

const CONFIG: TableConfig = {
  seats: SEATS,
  button: 0,
  blinds: { smallBlind: 5, bigBlind: 10 },
  handNumber: 7,
  seed: 42,
};

/** Plays a fixed script through the engine and returns the finished hand. */
function playScript(config: TableConfig, script: readonly Action[]): HandState {
  return script.reduce(
    (state, action) => applyAction(state, action),
    startHand(config, createRng(1)),
  );
}

/** A hand where three players see a showdown, with a fold and a bet on every street. */
function showdownHand(config: TableConfig = CONFIG): HandState {
  return playScript(config, [
    { type: 'raise', to: 30 }, // seat 0, first to act three-handed
    { type: 'fold' }, // seat 1, the small blind
    { type: 'call' }, // seat 2, the big blind
    { type: 'check' }, // flop
    { type: 'bet', to: 40 },
    { type: 'call' },
    { type: 'check' }, // turn
    { type: 'check' },
    { type: 'bet', to: 100 }, // river
    { type: 'call' },
  ]);
}

function frameFor(frames: readonly ReplayFrame[], match: (frame: ReplayFrame) => boolean) {
  const frame = frames.find(match);

  if (!frame) {
    throw new Error('No frame matched.');
  }

  return frame;
}

describe('replayHand', () => {
  it('produces one frame per event', () => {
    const hand = showdownHand();
    const frames = replayHand({ seats: SEATS, events: hand.events });

    expect(frames).toHaveLength(hand.events.length);
    expect(frames.map((frame) => frame.index)).toEqual(hand.events.map((_, index) => index));
  });

  it('ends on the stacks the engine ended on', () => {
    const hand = showdownHand();
    const frames = replayHand({ seats: SEATS, events: hand.events });
    const last = frames[frames.length - 1]?.snapshot;

    expect(last?.complete).toBe(true);
    // The engine ends a showdown hand on the street it was settled on, and the
    // replay follows it rather than inventing a `showdown` street of its own.
    expect(last?.street).toBe(hand.street);
    expect(last?.board).toEqual(hand.board);
    expect(last?.seats.map((seat) => seat.stack)).toEqual(
      hand.players.map((player) => player.stack),
    );
    // Every chip has been pushed to a winner, so nothing is left in the middle.
    expect(last && snapshotPot(last)).toBe(0);
  });

  it('holds the blinds in front of the seats that posted them', () => {
    const hand = showdownHand();
    const frames = replayHand({ seats: SEATS, events: hand.events });
    const posted = frameFor(
      frames,
      (frame) => frame.event.type === 'blindPosted' && frame.event.kind === 'bigBlind',
    ).snapshot;

    expect(posted.seats.map((seat) => seat.bet)).toEqual([0, 5, 10]);
    expect(posted.pot).toBe(0);
    expect(snapshotPot(posted)).toBe(15);
    expect(snapshotToCall(posted, 1)).toBe(5);
  });

  it('pulls the street into the middle when the next one is dealt', () => {
    const hand = showdownHand();
    const frames = replayHand({ seats: SEATS, events: hand.events });
    const flop = frameFor(
      frames,
      (frame) => frame.event.type === 'streetDealt' && frame.event.street === 'flop',
    ).snapshot;

    // Two players in for 30 each, plus the small blind that folded.
    expect(flop.pot).toBe(65);
    expect(flop.seats.every((seat) => seat.bet === 0)).toBe(true);
    expect(flop.board).toHaveLength(3);
    expect(flop.street).toBe('flop');
  });

  it('marks a folded seat and reveals the seats that showed down', () => {
    const hand = showdownHand();
    const frames = replayHand({ seats: SEATS, events: hand.events });
    const last = frameFor(frames, (frame) => frame.event.type === 'handEnd').snapshot;

    expect(last.seats[1]?.status).toBe('folded');
    expect(last.seats.filter((seat) => seat.shown).length).toBeGreaterThanOrEqual(1);
    expect(last.seats.filter((seat) => seat.won > 0)).toHaveLength(1);
    expect(last.seats.reduce((sum, seat) => sum + seat.won, 0)).toBe(345);
  });

  it('treats an ante as dead money rather than a bet in front of the seat', () => {
    const hand = showdownHand({ ...CONFIG, blinds: { smallBlind: 5, bigBlind: 10, ante: 1 } });
    const frames = replayHand({ seats: SEATS, events: hand.events });
    const posted = frameFor(
      frames,
      (frame) => frame.event.type === 'blindPosted' && frame.event.kind === 'bigBlind',
    ).snapshot;

    expect(posted.pot).toBe(3);
    expect(posted.seats.map((seat) => seat.bet)).toEqual([0, 5, 10]);
    expect(posted.seats.map((seat) => seat.stack)).toEqual([999, 994, 989]);
  });

  it('hands an uncalled bet back when everyone folds', () => {
    const hand = playScript(CONFIG, [
      { type: 'raise', to: 30 },
      { type: 'fold' },
      { type: 'fold' },
    ]);
    const frames = replayHand({ seats: SEATS, events: hand.events });
    const last = frames[frames.length - 1]?.snapshot;

    expect(last?.seats.map((seat) => seat.stack)).toEqual([1015, 995, 990]);
    expect(last?.seats[0]?.won).toBe(25);
    expect(last?.street).toBe('preflop');
  });

  it('names seats in its commentary and numbers them without names', () => {
    const hand = showdownHand();
    const frames = replayHand({ seats: SEATS, events: hand.events });
    const raise = frameFor(
      frames,
      (frame) => frame.event.type === 'actionTaken' && frame.event.action.type === 'raise',
    );

    expect(raise.description).toBe('Ava raises to 30');
    expect(frames[0]?.description).toBe('Hand #7 begins, button on Ava');
  });
});

describe('reviewsByFrame', () => {
  const frames = replayHand({ seats: SEATS, events: showdownHand().events });
  const actions = (seat: SeatIndex): readonly ReplayFrame[] =>
    frames.filter((frame) => frame.event.type === 'actionTaken' && frame.event.seat === seat);

  it('lands each review on the frame of the action it graded', () => {
    const acted = actions(0);
    const reviews = acted.map((_, index) => review({ evLoss: index }));
    const aligned = reviewsByFrame(frames, reviews, 0);

    expect(aligned).toHaveLength(frames.length);
    for (const [ordinal, frame] of acted.entries()) {
      expect(aligned[frame.index]).toBe(reviews[ordinal]);
    }
  });

  it('leaves every other frame null, including the other seats’ actions', () => {
    const aligned = reviewsByFrame(
      frames,
      actions(0).map(() => review()),
      0,
    );
    const graded = new Set(actions(0).map((frame) => frame.index));

    for (const [index, entry] of aligned.entries()) {
      expect(entry === null).toBe(!graded.has(index));
    }
  });

  it('refuses to guess when the counts disagree', () => {
    // One decision the coach could not grade is enough: pairing by ordinal from
    // here would blame the wrong action, so nothing is claimed at all.
    const short = actions(0)
      .slice(1)
      .map(() => review());

    expect(reviewsByFrame(frames, short, 0).every((entry) => entry === null)).toBe(true);
  });

  it('says nothing about a seat that never acted', () => {
    expect(reviewsByFrame(frames, [], 1).every((entry) => entry === null)).toBe(true);
  });
});

const FACTS: DecisionFacts = {
  street: 'flop',
  playersBehind: 1,
  pot: 60,
  toCall: 20,
  stack: 940,
  spr: 15.7,
  equity: 0.52,
  requiredEquity: 0.25,
  outs: 9,
};

function review(overrides: Partial<DecisionReview> = {}): DecisionReview {
  return {
    seat: 0,
    action: { type: 'call' },
    best: { type: 'call' },
    grade: 'correct',
    evLoss: 0,
    reason: 'Called 33% of pot with 52% equity, needing 25%.',
    leak: null,
    facts: FACTS,
    ...overrides,
  };
}

/**
 * The property harness: the replay must agree with the engine on every hand the
 * engine can produce, not just the ones written down above. Violations are
 * collected and asserted once — `expect` per check costs far more than the work.
 */
describe('replayHand invariants', () => {
  it('conserves chips and lands on the engine stacks over seeded hands', () => {
    const broken: string[] = [];

    for (let seed = 1; seed <= 400; seed++) {
      const rng = createRng(seed);
      const seats = randomSeats(rng);
      const config: TableConfig = {
        seats,
        button: rng.nextInt(seats.length),
        blinds: { smallBlind: 5, bigBlind: 10, ante: seed % 4 === 0 ? 1 : undefined },
        handNumber: seed,
        seed,
      };
      const hand = playRandomly(config, rng);
      const starting = seats.reduce((sum, seat) => sum + seat.stack, 0);
      const frames = replayHand({ seats, events: hand.events });

      for (const frame of frames) {
        const behind = frame.snapshot.seats.reduce((sum, seat) => sum + seat.stack, 0);

        if (behind + snapshotPot(frame.snapshot) !== starting) {
          broken.push(`seed ${seed} frame ${frame.index}: ${behind} behind + pot != ${starting}`);
        }

        if (frame.snapshot.seats.some((seat) => seat.stack < 0)) {
          broken.push(`seed ${seed} frame ${frame.index}: a seat went negative`);
        }
      }

      const last = frames[frames.length - 1]?.snapshot;

      if (!last?.complete) {
        broken.push(`seed ${seed}: replay did not end on a complete hand`);
      }

      const stacks = last?.seats.map((seat) => seat.stack) ?? [];

      if (stacks.join() !== hand.players.map((player) => player.stack).join()) {
        broken.push(`seed ${seed}: final stacks ${stacks.join()} disagree with the engine`);
      }

      if ((last?.board ?? []).join() !== hand.board.join()) {
        broken.push(`seed ${seed}: board disagrees with the engine`);
      }
    }

    expect(broken.slice(0, 10)).toEqual([]);
  });
});

function randomSeats(rng: Rng): { id: string; stack: number }[] {
  const count = 2 + rng.nextInt(8);

  return Array.from({ length: count }, (_, index) => ({
    id: `Seat ${index}`,
    // Stacks short enough to go all in, deep enough to see several streets.
    stack: 15 + rng.nextInt(400),
  }));
}

function playRandomly(config: TableConfig, rng: Rng): HandState {
  let state = startHand(config, rng);

  for (let step = 0; step < 500 && !state.complete; step++) {
    const legal = legalActions(state);

    if (legal.length === 0) {
      break;
    }

    state = applyAction(state, chooseAction(legal, rng));
  }

  return state;
}

function chooseAction(legal: readonly LegalAction[], rng: Rng): Action {
  const pick = legal[rng.nextInt(legal.length)] as LegalAction;

  if (pick.type !== 'bet' && pick.type !== 'raise') {
    return { type: pick.type };
  }

  const span = pick.max - pick.min;
  const to = span === 0 ? pick.min : pick.min + rng.nextInt(span + 1);

  return pick.type === 'bet' ? { type: 'bet', to } : { type: 'raise', to };
}
