/**
 * The hand the table screen renders until bots can deal one.
 *
 * A fixed script through the real engine rather than a hand-written fixture:
 * the cards, the pot layering and the showdown are whatever the rules produce,
 * so the screen is exercised by data it will actually be given later. Actions
 * never depend on cards, so the script stays legal whatever the seed deals.
 *
 * It is deliberately not a quiet hand — it runs a short stack all in for less
 * than a full raise on the turn, which is the layout case worth looking at.
 */

import { applyAction, createRng, startHand, type Action, type ReplayInput } from '@/engine';

/** Where the player sits. The table rotates so this seat is at the bottom. */
export const DEMO_HERO_SEAT = 0;

/** Chosen for the cards it deals: a set that fills up, and a shove drawing thin. */
const SEED = 4;

const SEATS = [
  { id: 'You', stack: 1000 },
  { id: 'Ava', stack: 1000 },
  { id: 'Ben', stack: 240 },
  { id: 'Cleo', stack: 1000 },
  { id: 'Dev', stack: 1000 },
  { id: 'Elle', stack: 1000 },
];

const SCRIPT: readonly Action[] = [
  { type: 'fold' }, // Cleo, first to act
  { type: 'fold' }, // Dev
  { type: 'raise', to: 30 }, // Elle opens
  { type: 'call' }, // You, on the button
  { type: 'fold' }, // Ava, the small blind
  { type: 'call' }, // Ben defends the big blind

  { type: 'check' }, // flop: Ben
  { type: 'bet', to: 45 }, // Elle continues
  { type: 'call' }, // You
  { type: 'call' }, // Ben

  { type: 'check' }, // turn: Ben
  { type: 'check' }, // Elle
  { type: 'bet', to: 120 }, // You
  { type: 'raise', to: 165 }, // Ben shoves for less than a full raise
  { type: 'fold' }, // Elle
  { type: 'call' }, // You — the river then runs out on its own
];

/** The finished demo hand, ready to hand to `replayHand`. */
export const DEMO_HAND: ReplayInput = buildDemoHand();

function buildDemoHand(): ReplayInput {
  const hand = SCRIPT.reduce(
    (state, action) => applyAction(state, action),
    startHand(
      {
        seats: SEATS,
        button: DEMO_HERO_SEAT,
        blinds: { smallBlind: 5, bigBlind: 10 },
        handNumber: 1,
        seed: SEED,
      },
      createRng(SEED),
    ),
  );

  return { seats: SEATS, events: hand.events };
}
