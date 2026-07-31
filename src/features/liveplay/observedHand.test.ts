import { formatCard, parseCard, parseCards, replayHand } from '@/engine';

import { buildObservedHand, type ObservedHandInput } from './observedHand';

const HERO: readonly [ReturnType<typeof parseCard>, ReturnType<typeof parseCard>] = [
  parseCard('Ah'),
  parseCard('Kh'),
];

function input(overrides: Partial<ObservedHandInput> = {}): ObservedHandInput {
  return {
    handNumber: 1,
    heroCards: HERO,
    board: parseCards('Qc 7d 2s 9s'),
    opponents: 2,
    heroStackBb: 100,
    reviews: [],
    seed: 7,
    ...overrides,
  };
}

describe('buildObservedHand', () => {
  it('synthesizes a full deck with the observed cards in their deal positions', () => {
    const hand = buildObservedHand(input());
    const opening = hand.events[0];

    expect(opening?.type).toBe('handStart');

    if (opening?.type !== 'handStart') {
      return;
    }

    expect(opening.deck).toHaveLength(52);
    expect(new Set(opening.deck.map(formatCard)).size).toBe(52);
    expect(opening.deck.slice(0, 2)).toEqual(HERO);

    // Three players' holes, then burn + flop, burn + turn.
    const holes = 2 * 3;

    expect(opening.deck.slice(holes + 1, holes + 4)).toEqual(parseCards('Qc 7d 2s'));
    expect(opening.deck[holes + 5]).toBe(parseCard('9s'));
  });

  it('logs only what was observed: hero cards, streets, the end', () => {
    const hand = buildObservedHand(input());

    expect(hand.events.map((event) => event.type)).toEqual([
      'handStart',
      'holeCardsDealt',
      'streetDealt',
      'streetDealt',
      'handEnd',
    ]);
    expect(hand.heroNet).toBe(0);
    expect(hand.events.at(-1)).toMatchObject({ type: 'handEnd', street: 'turn' });
  });

  it('treats a board that never completed its flop as preflop', () => {
    const hand = buildObservedHand(input({ board: parseCards('Qc 7d') }));

    expect(hand.events.map((event) => event.type)).toEqual([
      'handStart',
      'holeCardsDealt',
      'handEnd',
    ]);
    expect(hand.events.at(-1)).toMatchObject({ street: 'preflop' });
  });

  it('is deterministic for the same seed and differs across seeds', () => {
    expect(buildObservedHand(input())).toEqual(buildObservedHand(input()));
    expect(buildObservedHand(input({ seed: 8 }))).not.toEqual(buildObservedHand(input()));
  });

  it('replays through the real replayer, board intact and villains hidden', () => {
    const hand = buildObservedHand(input());
    const frames = replayHand({ seats: hand.seats, events: hand.events });
    const last = frames.at(-1);

    expect(last).toBeDefined();
    expect(last?.snapshot.board).toEqual(parseCards('Qc 7d 2s 9s'));

    const heroSeat = last?.snapshot.seats[0];
    const villain = last?.snapshot.seats[1];

    expect(heroSeat?.holeCards).toEqual(HERO);
    expect(villain?.holeCards ?? null).toBeNull();
  });
});
