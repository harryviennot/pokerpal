import { legalActions, totalPot } from '@/engine';

import { HERO_SEAT, usePracticeStore } from './usePracticeStore';

const read = () => usePracticeStore.getState();

/**
 * Plays the hero as a calling station, taking the action from the engine rather
 * than assuming one: `call` is not offered when checking is free, and a loop
 * that sends it anyway is ignored forever.
 */
function heroCalls(): void {
  const legal = legalActions(read().hand);
  const call = legal.find((action) => action.type === 'call');

  read().act(call ? { type: 'call' } : { type: 'check' });
}

beforeEach(() => {
  read().reset();
});

describe('usePracticeStore', () => {
  it('deals a hand and stops on the hero', () => {
    const { hand, handSeats } = read();

    expect(hand.toAct).toBe(HERO_SEAT);
    expect(hand.complete).toBe(false);
    expect(hand.players).toHaveLength(6);
    expect(handSeats.every((seat) => seat.stack === 1000)).toBe(true);
    // The hero has cards and the bots in front of them have acted.
    expect(hand.players[HERO_SEAT]?.holeCards).not.toBeNull();
  });

  it('offers the hero only what the rules allow', () => {
    const legal = legalActions(read().hand);

    expect(legal.map((action) => action.type).sort()).toEqual(['call', 'fold', 'raise']);
  });

  it('plays the hero action and runs the table back round to them', () => {
    const before = totalPot(read().hand);

    read().act({ type: 'call' });

    const { hand } = read();

    expect(totalPot(hand)).toBeGreaterThan(before);
    // Either it is the hero's turn again, or the hand finished without them.
    expect(hand.complete || hand.toAct === HERO_SEAT).toBe(true);
  });

  it('runs the hand out when the hero folds', () => {
    read().act({ type: 'fold' });

    const { hand } = read();

    expect(hand.complete).toBe(true);
    expect(hand.players[HERO_SEAT]?.status).toBe('folded');
  });

  it('ignores an action that is not legal rather than throwing', () => {
    const before = read().hand;

    // Nobody may check facing the big blind.
    read().act({ type: 'check' });

    expect(read().hand).toBe(before);
  });

  it('ignores an action when it is not the hero on the clock', () => {
    read().act({ type: 'fold' });

    const finished = read().hand;

    read().act({ type: 'call' });

    expect(read().hand).toBe(finished);
  });

  it('will not deal the next hand while one is in progress', () => {
    const before = read().hand;

    read().nextHand();

    expect(read().hand).toBe(before);
  });

  it('books the finished hand and deals another', () => {
    read().act({ type: 'fold' });

    const played = read().hand;

    read().nextHand();

    const { hand, session, handSeats } = read();

    expect(session.handsPlayed).toBe(1);
    expect(session.history).toHaveLength(1);
    expect(hand.handNumber).toBe(played.handNumber + 1);
    expect(hand.complete).toBe(false);
    // The button has moved, and the stacks carried over from the hand before.
    expect(hand.button).not.toBe(played.button);
    expect(handSeats.reduce((sum, seat) => sum + seat.stack, 0)).toBe(6000);
  });

  it('conserves chips within every hand of a run', () => {
    for (let hand = 0; hand < 20; hand++) {
      // Measured per hand, not across the session: a rebuy between hands puts
      // chips back on the table on purpose, so the session total does move.
      const before = read().handSeats.reduce((sum, seat) => sum + seat.stack, 0);

      for (let step = 0; step < 100 && !read().hand.complete; step++) {
        heroCalls();
      }

      expect(read().hand.complete).toBe(true);
      expect(read().hand.players.reduce((sum, player) => sum + player.stack, 0)).toBe(before);

      read().nextHand();
    }
  });

  it('grades the hero once the hand is over, and only the hero', () => {
    expect(read().reviews).toEqual([]);

    read().act({ type: 'fold' });

    const { hand, reviews } = read();

    expect(hand.complete).toBe(true);
    expect(reviews.length).toBeGreaterThan(0);
    expect(reviews.every((review) => review.seat === HERO_SEAT)).toBe(true);
  });

  it('books the grades with the hand and starts the next one clean', () => {
    read().act({ type: 'fold' });

    const played = read().hand;
    const graded = read().reviews;
    const net = (played.players[HERO_SEAT]?.stack ?? 0) - (read().handSeats[HERO_SEAT]?.stack ?? 0);

    read().nextHand();

    expect(read().coachHistory).toEqual([{ handNumber: played.handNumber, net, reviews: graded }]);
    expect(read().reviews).toEqual([]);
  });

  it('clears the coaching on reset', () => {
    read().act({ type: 'fold' });
    read().nextHand();
    read().reset();

    expect(read().reviews).toEqual([]);
    expect(read().coachHistory).toEqual([]);
  });

  it('replays identically from the same seed', () => {
    read().act({ type: 'call' });

    const first = read().hand.events;

    read().reset();
    read().act({ type: 'call' });

    expect(read().hand.events).toEqual(first);
  });
});
