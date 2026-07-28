import { makeCard } from '@/engine';

import {
  boardCards,
  hasBoardGap,
  heroHand,
  MAX_OPPONENTS,
  MIN_OPPONENTS,
  usedCards,
  useOddsStore,
} from './useOddsStore';

const reset = (): void => {
  useOddsStore.setState({
    cards: {},
    focusedSlot: 'hero1',
    opponentCount: 1,
    rangePreset: 'random',
    potInput: '',
    betInput: '',
  });
};

const store = () => useOddsStore.getState();

beforeEach(reset);

describe('card entry', () => {
  it('places a picked card in the focused slot', () => {
    store().setCard(makeCard(14, 'h'));

    expect(store().cards.hero1).toBe(makeCard(14, 'h'));
  });

  it('advances to the next empty slot so entry is a continuous run of taps', () => {
    store().setCard(makeCard(14, 'h'));
    expect(store().focusedSlot).toBe('hero2');

    store().setCard(makeCard(13, 'h'));
    expect(store().focusedSlot).toBe('flop1');
  });

  it('moves a card rather than duplicating it when it is already in play', () => {
    const ace = makeCard(14, 'h');

    store().setCard(ace);
    store().focusSlot('flop1');
    store().setCard(ace);

    expect(store().cards.hero1).toBeUndefined();
    expect(store().cards.flop1).toBe(ace);
    expect(usedCards(store().cards)).toEqual([ace]);
  });

  it('clears a slot and focuses it, so a mistap is one tap to fix', () => {
    store().setCard(makeCard(14, 'h'));
    store().setCard(makeCard(13, 'h'));
    store().clearSlot('hero1');

    expect(store().cards.hero1).toBeUndefined();
    expect(store().focusedSlot).toBe('hero1');
  });

  it('clears everything back to the first slot', () => {
    store().setCard(makeCard(14, 'h'));
    store().setCard(makeCard(13, 'h'));
    store().clearAll();

    expect(usedCards(store().cards)).toHaveLength(0);
    expect(store().focusedSlot).toBe('hero1');
  });

  it('stays put once every slot is filled', () => {
    for (const rank of [14, 13, 12, 11, 10, 9, 8] as const) {
      store().setCard(makeCard(rank, 'h'));
    }

    const focused = store().focusedSlot;

    store().focusSlot('river');
    store().setCard(makeCard(7, 'h'));

    expect(store().cards.river).toBe(makeCard(7, 'h'));
    expect(focused).toBeDefined();
  });
});

describe('derived hand and board', () => {
  it('reports no hand until both hole cards are chosen', () => {
    expect(heroHand(store().cards)).toBeNull();

    store().setCard(makeCard(14, 'h'));
    expect(heroHand(store().cards)).toBeNull();

    store().setCard(makeCard(13, 'h'));
    expect(heroHand(store().cards)).toEqual([makeCard(14, 'h'), makeCard(13, 'h')]);
  });

  it('reads the board as a contiguous prefix', () => {
    store().focusSlot('flop1');
    store().setCard(makeCard(12, 's'));
    store().setCard(makeCard(11, 'd'));

    expect(boardCards(store().cards)).toHaveLength(2);
  });

  it('stops at a gap rather than treating a stray turn card as the flop', () => {
    store().focusSlot('turn');
    store().setCard(makeCard(12, 's'));

    expect(boardCards(store().cards)).toHaveLength(0);
    expect(hasBoardGap(store().cards)).toBe(true);
  });

  it('reports no gap for a complete flop', () => {
    store().focusSlot('flop1');
    store().setCard(makeCard(12, 's'));
    store().setCard(makeCard(11, 'd'));
    store().setCard(makeCard(4, 'c'));

    expect(hasBoardGap(store().cards)).toBe(false);
    expect(boardCards(store().cards)).toHaveLength(3);
  });
});

describe('opponent count', () => {
  it('clamps to the supported range', () => {
    store().setOpponentCount(0);
    expect(store().opponentCount).toBe(MIN_OPPONENTS);

    store().setOpponentCount(99);
    expect(store().opponentCount).toBe(MAX_OPPONENTS);
  });
});
