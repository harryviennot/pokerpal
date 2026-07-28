/**
 * Property tests: thousands of seeded hands played by a random-but-legal
 * chooser, checking after every single transition that the rules held.
 *
 * The scripted tests in `hand.test.ts` prove the situations we thought of.
 * This proves the ones we did not — and it is what makes the engine safe to
 * hand to bots, which will find every unreachable branch eventually.
 *
 * Violations are collected as strings and asserted once at the end rather than
 * with an `expect` per check. Jest's matchers cost far more than the engine
 * does here, and `npm run test:engine` has to stay fast enough to leave
 * running while editing.
 */

import { legalActions } from './betting';
import { CARD_COUNT } from './cards';
import { applyAction, startHand } from './hand';
import { createRng, type Rng } from './rng';
import { totalPot, type Action, type HandState, type LegalAction, type TableConfig } from './table';

/** Turns a legal-action descriptor into a concrete action, sizing bets randomly. */
function chooseAction(legal: readonly LegalAction[], rng: Rng): Action {
  const pick = legal[rng.nextInt(legal.length)] as LegalAction;

  if (pick.type !== 'bet' && pick.type !== 'raise') {
    return { type: pick.type };
  }

  // Spread sizes across the legal band rather than always shoving, so min
  // raises, incomplete all-in raises and everything between get exercised.
  const span = pick.max - pick.min;
  const to = span === 0 ? pick.min : pick.min + rng.nextInt(span + 1);

  return pick.type === 'bet' ? { type: 'bet', to } : { type: 'raise', to };
}

const BOARD_SIZE: Record<HandState['street'], number> = {
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
  showdown: 5,
};

/** Every rule that must hold after any transition. Returns what broke, if anything. */
function violations(state: HandState, startingChips: number): string[] {
  const broken: string[] = [];
  const check = (ok: boolean, message: string): void => {
    if (!ok) {
      broken.push(message);
    }
  };

  const inStacks = state.players.reduce((sum, player) => sum + player.stack, 0);
  const wagered = totalPot(state);

  // Chips are conserved: everything is either behind a player or in the pot.
  check(
    inStacks + (state.complete ? 0 : wagered) === startingChips,
    `chips leaked: ${inStacks} behind + ${wagered} wagered != ${startingChips}`,
  );

  for (const player of state.players) {
    check(player.stack >= 0, `seat ${player.seat} has a negative stack`);
    check(Number.isInteger(player.stack), `seat ${player.seat} holds a fractional chip`);
    check(
      player.committedTotal >= player.committedThisStreet,
      `seat ${player.seat} committed more this street than all hand`,
    );

    // While the hand is live, an all-in seat has nothing behind. Once it ends
    // the status records how the hand was played, so a winner who was all in
    // keeps that status with the pot sitting in front of them.
    check(
      player.status !== 'allIn' || state.complete || player.stack === 0,
      `seat ${player.seat} is all in with ${player.stack} behind`,
    );
  }

  // Exactly one seat is on the clock while the hand is live, and it is one
  // that can actually do something.
  if (!state.complete) {
    const actor = state.toAct === null ? null : state.players[state.toAct];

    check(actor !== null && actor !== undefined, 'a live hand has nobody to act');
    check(
      !actor || (actor.status === 'active' && actor.stack > 0),
      `seat ${state.toAct} is on the clock but cannot act`,
    );
  }

  // No card is dealt twice, and dealt + burned + undealt accounts for all 52.
  const seen = new Set<number>(state.board);
  let duplicates = 0;

  for (const player of state.players) {
    for (const card of player.holeCards ?? []) {
      if (seen.has(card)) {
        duplicates++;
      }
      seen.add(card);
    }
  }

  const burned = state.events.filter((event) => event.type === 'streetDealt').length;

  check(duplicates === 0, `${duplicates} card(s) dealt twice`);
  check(
    seen.size + burned + state.deck.length === CARD_COUNT,
    `card count is ${seen.size + burned + state.deck.length}, not ${CARD_COUNT}`,
  );
  check(
    state.board.length === BOARD_SIZE[state.street],
    `${state.board.length} board cards on the ${state.street}`,
  );

  return broken;
}

interface Run {
  hands: number;
  broken: string[];
  showdowns: number;
  folds: number;
  potsMatchWagers: boolean;
}

/** Plays `hands` random hands, collecting every invariant violation seen. */
function playRandomHands(
  hands: number,
  rng: Rng,
  makeConfig: (rng: Rng) => TableConfig,
  onlyFirst = 5,
): Run {
  const run: Run = { hands: 0, broken: [], showdowns: 0, folds: 0, potsMatchWagers: true };

  for (let hand = 0; hand < hands; hand++) {
    const config = makeConfig(rng);
    const startingChips = config.seats.reduce((sum, seat) => sum + seat.stack, 0);
    let state = startHand(config, rng);
    let actions = 0;

    const record = (): void => {
      if (run.broken.length < onlyFirst) {
        run.broken.push(...violations(state, startingChips).map((v) => `hand ${hand}: ${v}`));
      }
    };

    record();

    while (!state.complete) {
      const legal = legalActions(state);

      if (legal.length === 0) {
        run.broken.push(`hand ${hand}: seat ${state.toAct} has no legal action`);
        break;
      }

      state = applyAction(state, chooseAction(legal, rng));
      actions++;
      record();

      // A hand cannot go on forever: every raise strictly increases the price,
      // so the action count is bounded by the chips in play.
      if (actions > 500) {
        run.broken.push(`hand ${hand}: did not terminate within 500 actions`);
        break;
      }
    }

    if (!state.complete) {
      run.broken.push(`hand ${hand}: ended incomplete`);
      continue;
    }

    if (state.players.reduce((sum, player) => sum + player.stack, 0) !== startingChips) {
      run.broken.push(`hand ${hand}: payouts did not restore the starting chips`);
    }

    if (state.pots.reduce((sum, pot) => sum + pot.amount, 0) !== totalPot(state)) {
      run.potsMatchWagers = false;
    }

    if (state.events.some((event) => event.type === 'showdownHand')) {
      run.showdowns++;
    } else {
      run.folds++;
    }

    run.hands++;
  }

  return run;
}

function config(stacks: readonly number[], button: number, ante = 0): TableConfig {
  return {
    seats: stacks.map((stack, index) => ({ id: `p${index}`, stack })),
    button,
    blinds: { smallBlind: 5, bigBlind: 10, ...(ante > 0 ? { ante } : {}) },
  };
}

/** Deliberately lumpy stacks: equal stacks almost never produce side pots. */
function lumpyTable(rng: Rng, min: number, spread: number, ante = 0): TableConfig {
  const seatCount = 2 + rng.nextInt(8);
  const stacks = Array.from({ length: seatCount }, () => min + rng.nextInt(spread));

  return config(stacks, rng.nextInt(seatCount), ante);
}

describe('random legal play', () => {
  it('holds every invariant over 5,000 hands at varied table sizes', () => {
    const run = playRandomHands(5000, createRng(20260728), (rng) => lumpyTable(rng, 20, 2000));

    expect(run.broken).toEqual([]);
    expect(run.hands).toBe(5000);
  });

  it('holds with antes in play', () => {
    const run = playRandomHands(1000, createRng(31337), (rng) => lumpyTable(rng, 20, 500, 2));

    expect(run.broken).toEqual([]);
    expect(run.hands).toBe(1000);
  });

  it('holds when players are too short to cover a blind', () => {
    // Stacks of 1 to 30 against blinds of 5/10: forced all-ins everywhere.
    const run = playRandomHands(1000, createRng(4242), (rng) => lumpyTable(rng, 1, 30));

    expect(run.broken).toEqual([]);
    expect(run.hands).toBe(1000);
  });

  it('always pays out exactly the chips that were wagered', () => {
    const run = playRandomHands(1000, createRng(909), (rng) => lumpyTable(rng, 50, 1000));

    expect(run.broken).toEqual([]);
    expect(run.potsMatchWagers).toBe(true);
  });

  it('reaches both showdowns and folded-out hands', () => {
    const run = playRandomHands(400, createRng(5150), (rng) =>
      config([500, 500, 500, 500], rng.nextInt(4)),
    );

    // Not a claim about strategy, just that the harness exercises both terminal
    // paths rather than folding out every time.
    expect(run.showdowns).toBeGreaterThan(0);
    expect(run.folds).toBeGreaterThan(0);
    expect(run.broken).toEqual([]);
  });
});
