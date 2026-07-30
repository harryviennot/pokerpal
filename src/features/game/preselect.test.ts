import { applyAction, createRng, startHand, type HandState } from '@/engine';

import { resolvePreselect } from './preselect';

const CONFIG = {
  seats: [
    { id: 'You', stack: 1_000 },
    { id: 'Ava', stack: 1_000 },
    { id: 'Ben', stack: 1_000 },
  ],
  button: 0,
  blinds: { smallBlind: 5, bigBlind: 10 },
  handNumber: 1,
  seed: 7,
};

/** Preflop, so whoever is to act owes the big blind. */
function facingABet(): HandState {
  return startHand(CONFIG, createRng(7));
}

/** The flop, checked to the seat on the clock: nothing to call. */
function checkingIsFree(): HandState {
  let hand = facingABet();

  for (const action of [{ type: 'call' }, { type: 'call' }, { type: 'check' }] as const) {
    hand = applyAction(hand, action);
  }

  return hand;
}

describe('resolvePreselect', () => {
  it('checks when checking is free, whatever was armed', () => {
    const hand = checkingIsFree();

    expect(resolvePreselect('checkFold', hand)).toEqual({ type: 'check' });
    expect(resolvePreselect('check', hand)).toEqual({ type: 'check' });
    expect(resolvePreselect('callAny', hand)).toEqual({ type: 'check' });
  });

  it('folds a check-fold to a price', () => {
    expect(resolvePreselect('checkFold', facingABet())).toEqual({ type: 'fold' });
  });

  it('drops a check that a bet has invalidated rather than folding', () => {
    // The rule the whole module exists for: a raise arriving after the player
    // armed a free check must not throw their hand away for them.
    expect(resolvePreselect('check', facingABet())).toBeNull();
  });

  it('calls whatever it costs', () => {
    expect(resolvePreselect('callAny', facingABet())).toEqual({ type: 'call' });
  });

  it('has nothing to play once the hand is over', () => {
    let hand = facingABet();

    hand = applyAction(hand, { type: 'fold' });
    hand = applyAction(hand, { type: 'fold' });

    expect(hand.complete).toBe(true);
    expect(resolvePreselect('checkFold', hand)).toBeNull();
    expect(resolvePreselect('check', hand)).toBeNull();
    expect(resolvePreselect('callAny', hand)).toBeNull();
  });
});
