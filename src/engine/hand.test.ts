import { legalActions } from './betting';
import { parseCards, type Card } from './cards';
import { allCards } from './cards';
import { applyAction, dealHand, startHand } from './hand';
import { createRng } from './rng';
import { totalPot, type Action, type HandState, type TableConfig } from './table';

/**
 * Hands are dealt from a stacked deck rather than a seed so a scenario reads as
 * the poker situation it is. `dealHand` takes the deck directly, which is the
 * same entry point replay uses.
 */
function stackDeck(holeCards: readonly string[], board: string): Card[] {
  const holes = holeCards.map((cards) => parseCards(cards));
  const dealt: Card[] = [];

  // Two rounds, one card at a time, matching how the engine deals.
  for (let round = 0; round < 2; round++) {
    for (const hand of holes) {
      dealt.push(hand[round] as Card);
    }
  }

  const boardCards = parseCards(board);
  const used = new Set<number>([...dealt, ...boardCards]);
  const rest = allCards().filter((card) => !used.has(card));
  const burn = (): Card => rest.pop() as Card;

  return [
    ...dealt,
    burn(),
    ...boardCards.slice(0, 3),
    burn(),
    ...boardCards.slice(3, 4),
    burn(),
    ...boardCards.slice(4, 5),
    ...rest,
  ];
}

function table(stacks: readonly number[], button = 0, ante = 0): TableConfig {
  return {
    seats: stacks.map((stack, index) => ({ id: `p${index}`, stack })),
    button,
    blinds: { smallBlind: 5, bigBlind: 10, ...(ante > 0 ? { ante } : {}) },
    handNumber: 1,
    seed: 42,
  };
}

/** Plays a scripted list of actions in order. */
function play(state: HandState, actions: readonly Action[]): HandState {
  return actions.reduce(applyAction, state);
}

const stacks = (state: HandState): number[] => state.players.map((player) => player.stack);

describe('dealHand', () => {
  it('posts blinds and deals two cards to every seat', () => {
    const state = dealHand(
      table([1000, 1000, 1000]),
      stackDeck(['Ah Ad', 'Kh Kd', 'Qh Qd'], 'Ac Kc Qc Jc 9d'),
    );

    expect(state.players.every((player) => player.holeCards !== null)).toBe(true);
    expect(state.players[1]?.committedThisStreet).toBe(5); // small blind
    expect(state.players[2]?.committedThisStreet).toBe(10); // big blind
    expect(state.currentBet).toBe(10);
    expect(state.minRaiseTo).toBe(20);
  });

  it('deals one card at a time starting left of the button', () => {
    const state = dealHand(
      table([1000, 1000, 1000]),
      stackDeck(['Ah Ad', 'Kh Kd', 'Qh Qd'], 'Ac Kc Qc Jc 9d'),
    );

    // The stacked deck lists hole cards left of the button first, so seat 1
    // holds the first pair listed.
    expect(state.players[1]?.holeCards).toEqual(parseCards('Ah Ad'));
    expect(state.players[2]?.holeCards).toEqual(parseCards('Kh Kd'));
    expect(state.players[0]?.holeCards).toEqual(parseCards('Qh Qd'));
  });

  it('opens the action under the gun three-handed', () => {
    const state = dealHand(
      table([1000, 1000, 1000]),
      stackDeck(['Ah Ad', 'Kh Kd', 'Qh Qd'], 'Ac Kc Qc Jc 9d'),
    );

    expect(state.toAct).toBe(0); // the button acts first three-handed
  });

  it('puts the button on the small blind heads-up and gives it the first action', () => {
    const state = dealHand(table([1000, 1000]), stackDeck(['Ah Ad', 'Kh Kd'], 'Ac Kc Qc Jc 9d'));

    expect(state.players[0]?.committedThisStreet).toBe(5);
    expect(state.players[1]?.committedThisStreet).toBe(10);
    expect(state.toAct).toBe(0);
  });

  it('collects antes as dead money outside the street bet', () => {
    const state = dealHand(
      table([1000, 1000, 1000], 0, 2),
      stackDeck(['Ah Ad', 'Kh Kd', 'Qh Qd'], 'Ac Kc Qc Jc 9d'),
    );

    expect(totalPot(state)).toBe(6 + 5 + 10);
    expect(state.players[0]?.committedThisStreet).toBe(0); // ante only, nothing owed back
    expect(state.players[0]?.committedTotal).toBe(2);
  });

  it('rejects a table that cannot play a hand', () => {
    expect(() => dealHand(table([1000]), stackDeck(['Ah Ad'], 'Ac Kc Qc Jc 9d'))).toThrow();
    expect(() =>
      dealHand(table([1000, 0]), stackDeck(['Ah Ad', 'Kh Kd'], 'Ac Kc Qc Jc 9d')),
    ).toThrow();
  });
});

describe('a hand that ends before showdown', () => {
  it('gives the blinds to the big blind when everyone folds', () => {
    const state = dealHand(
      table([1000, 1000, 1000]),
      stackDeck(['Ah Ad', 'Kh Kd', 'Qh Qd'], 'Ac Kc Qc Jc 9d'),
    );
    const done = play(state, [{ type: 'fold' }, { type: 'fold' }]);

    expect(done.complete).toBe(true);
    // Seat 0 is the button and paid nothing; the big blind gets its own 10 back
    // as an uncalled bet and wins the 5 small blind on top.
    expect(stacks(done)).toEqual([1000, 995, 1005]);
  });

  it('returns the uncalled part of a bet nobody matched', () => {
    const state = dealHand(
      table([1000, 1000, 1000]),
      stackDeck(['Ah Ad', 'Kh Kd', 'Qh Qd'], 'Ac Kc Qc Jc 9d'),
    );
    const done = play(state, [
      { type: 'raise', to: 100 }, // seat 0 opens
      { type: 'fold' }, // seat 1
      { type: 'fold' }, // seat 2
    ]);

    // Seat 0 wins the 15 in blinds; the 90 nobody called comes straight back.
    expect(stacks(done)).toEqual([1015, 995, 990]);
    expect(done.events.some((event) => event.type === 'uncalledBetReturned')).toBe(true);
  });

  it('never shows cards when the hand is won without a showdown', () => {
    const state = dealHand(
      table([1000, 1000, 1000]),
      stackDeck(['Ah Ad', 'Kh Kd', 'Qh Qd'], 'Ac Kc Qc Jc 9d'),
    );
    const done = play(state, [{ type: 'fold' }, { type: 'fold' }]);

    expect(done.events.some((event) => event.type === 'showdownHand')).toBe(false);
  });
});

describe('a hand played to showdown', () => {
  it('checks down through every street and pays the best hand', () => {
    // Seat 1 holds aces, seat 2 kings, seat 0 queens; the board misses all three.
    const state = dealHand(
      table([1000, 1000, 1000]),
      stackDeck(['Ah Ad', 'Kh Kd', 'Qh Qd'], '2c 7d 9s 3h 4c'),
    );

    const done = play(state, [
      { type: 'call' }, // seat 0 limps
      { type: 'call' }, // small blind completes
      { type: 'check' }, // big blind takes its option
      { type: 'check' },
      { type: 'check' },
      { type: 'check' }, // flop checked through
      { type: 'check' },
      { type: 'check' },
      { type: 'check' }, // turn
      { type: 'check' },
      { type: 'check' },
      { type: 'check' }, // river
    ]);

    expect(done.complete).toBe(true);
    expect(done.street).toBe('river');
    expect(done.board).toHaveLength(5);
    expect(stacks(done)).toEqual([990, 1020, 990]);
  });

  it('gives the big blind an option to raise an unraised pot', () => {
    const state = dealHand(
      table([1000, 1000, 1000]),
      stackDeck(['Ah Ad', 'Kh Kd', 'Qh Qd'], '2c 7d 9s 3h 4c'),
    );
    const limped = play(state, [{ type: 'call' }, { type: 'call' }]);

    expect(limped.toAct).toBe(2);
    expect(limped.street).toBe('preflop');
    expect(legalActions(limped).map((action) => action.type)).toEqual(['check', 'raise']);
  });

  it('splits a pot between two identical hands', () => {
    // Both blinds play the board: a broadway straight neither can improve on.
    const state = dealHand(table([1000, 1000]), stackDeck(['2c 3d', '4h 5s'], 'Ah Kh Qs Jd Tc'));

    const done = play(state, [
      { type: 'call' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
    ]);

    expect(stacks(done)).toEqual([1000, 1000]);
  });
});

describe('all-in run-out', () => {
  it('deals the remaining streets itself when nobody can act again', () => {
    const state = dealHand(table([500, 500]), stackDeck(['Ah Ad', 'Kh Kd'], '2c 7d 9s 3h 4c'));

    const done = play(state, [{ type: 'raise', to: 500 }, { type: 'call' }]);

    expect(done.complete).toBe(true);
    expect(done.board).toHaveLength(5);
    expect(done.toAct).toBeNull();
    // Cards go out left of the button first, so seat 1 holds the aces.
    expect(stacks(done)).toEqual([0, 1000]);
  });

  it('stops asking for actions once only one player has chips behind', () => {
    // Seat 1 is all in for less; seat 0 covers and has nothing to bet into.
    const state = dealHand(
      table([1000, 120, 1000]),
      stackDeck(['Ah Ad', 'Kh Kd', 'Qh Qd'], '2c 7d 9s 3h 4c'),
    );

    const done = play(state, [
      { type: 'fold' }, // seat 0 folds the button
      { type: 'raise', to: 120 }, // seat 1 shoves the small blind
      { type: 'call' }, // seat 2 calls
    ]);

    expect(done.complete).toBe(true);
    expect(done.board).toHaveLength(5);
    expect(stacks(done)).toEqual([1000, 240, 880]);
  });

  it('builds a side pot the short stack cannot win', () => {
    // Seat 1 holds aces but is all in for only 100. Seats 0 and 2 get all 400
    // in, so the side pot is contested by queens and kings alone.
    const state = dealHand(
      table([400, 100, 400], 0),
      stackDeck(['Ah Ad', 'Kh Kd', 'Qh Qd'], '2c 7d 9s 3h 4c'),
    );

    const done = play(state, [
      { type: 'raise', to: 400 }, // seat 0 shoves with queens
      { type: 'call' }, // seat 1 calls all in for 100
      { type: 'call' }, // seat 2 calls with kings
    ]);

    expect(done.complete).toBe(true);
    expect(done.pots).toHaveLength(2);
    expect(done.pots[0]?.amount).toBe(300); // 100 x 3
    expect(done.pots[1]?.amount).toBe(600); // 300 x 2
    // Aces take the main pot; kings take the side pot the aces could not reach.
    expect(stacks(done)).toEqual([0, 300, 600]);
  });

  it('offers only a call to a short stack that cannot cover the bet', () => {
    const state = dealHand(
      table([400, 100, 400], 0),
      stackDeck(['Ah Ad', 'Kh Kd', 'Qh Qd'], '2c 7d 9s 3h 4c'),
    );
    const facingShove = applyAction(state, { type: 'raise', to: 400 });

    expect(legalActions(facingShove)).toEqual([{ type: 'fold' }, { type: 'call', amount: 95 }]);
  });
});

describe('run-out reveals', () => {
  it('tables every contesting hand before dealing the run-out', () => {
    const state = dealHand(table([500, 500]), stackDeck(['Ah Ad', 'Kh Kd'], '2c 7d 9s 3h 4c'));

    const done = play(state, [{ type: 'raise', to: 500 }, { type: 'call' }]);
    const types = done.events.map((event) => event.type);

    // Both hands come up, and they come up before any board card does.
    expect(types.filter((type) => type === 'handRevealed')).toHaveLength(2);
    expect(types.indexOf('handRevealed')).toBeLessThan(types.indexOf('streetDealt'));
  });

  it('never mucks a hand the run-out already tabled', () => {
    const state = dealHand(table([500, 500]), stackDeck(['Ah Ad', 'Kh Kd'], '2c 7d 9s 3h 4c'));

    const done = play(state, [{ type: 'raise', to: 500 }, { type: 'call' }]);
    const types = done.events.map((event) => event.type);

    expect(types).not.toContain('handMucked');
    expect(types.filter((type) => type === 'showdownHand')).toHaveLength(2);
  });

  it('reveals the last aggressor first and skips folded seats', () => {
    const state = dealHand(
      table([1000, 120, 1000]),
      stackDeck(['Ah Ad', 'Kh Kd', 'Qh Qd'], '2c 7d 9s 3h 4c'),
    );

    const done = play(state, [
      { type: 'fold' }, // seat 0 folds the button
      { type: 'raise', to: 120 }, // seat 1 shoves the small blind
      { type: 'call' }, // seat 2 calls
    ]);
    const reveals = done.events.flatMap((event) =>
      event.type === 'handRevealed' ? [event.seat] : [],
    );

    expect(reveals).toEqual([1, 2]);
  });

  it('leaves an ordinary river showdown alone: no reveals, mucking intact', () => {
    // Checked down to the river; the first hand to show is the pair of aces,
    // so the junk behind it mucks rather than showing for nothing.
    const state = dealHand(table([1000, 1000]), stackDeck(['Ah Ad', '2c 3d'], 'Kh Qs Jd 9c 4s'));

    const done = play(state, [
      { type: 'call' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
    ]);
    const types = done.events.map((event) => event.type);

    expect(types).not.toContain('handRevealed');
    expect(types).toContain('handMucked');
  });
});

describe('startHand', () => {
  it('is deterministic for a seed', () => {
    const config = table([1000, 1000, 1000]);
    const a = startHand(config, createRng(99));
    const b = startHand(config, createRng(99));

    expect(a.players.map((player) => player.holeCards)).toEqual(
      b.players.map((player) => player.holeCards),
    );
  });

  it('deals different hands from different seeds', () => {
    const config = table([1000, 1000, 1000]);
    const a = startHand(config, createRng(1));
    const b = startHand(config, createRng(2));

    expect(a.players[0]?.holeCards).not.toEqual(b.players[0]?.holeCards);
  });

  it('records the deck it dealt from so the hand can be replayed', () => {
    const config = table([1000, 1000, 1000]);
    const original = startHand(config, createRng(7));
    const opening = original.events[0];

    expect(opening?.type).toBe('handStart');

    if (opening?.type !== 'handStart') {
      throw new Error('expected the log to open with handStart');
    }

    const replayed = dealHand(config, opening.deck);

    expect(replayed.players.map((player) => player.holeCards)).toEqual(
      original.players.map((player) => player.holeCards),
    );
  });
});
