import { amountToCall, legalActions, parseCard, parseCards, totalPot } from '@/engine';

import {
  buildLiveHandState,
  LIVE_BIG_BLIND,
  streetOfBoard,
  type LiveObservation,
} from './liveHandState';

const HERO: readonly [ReturnType<typeof parseCard>, ReturnType<typeof parseCard>] = [
  parseCard('Ah'),
  parseCard('Kh'),
];

function observation(overrides: Partial<LiveObservation> = {}): LiveObservation {
  return {
    heroCards: HERO,
    board: parseCards('Qh 7c 2d'),
    opponents: 2,
    potBb: 10,
    toCallBb: 4,
    heroStackBb: 100,
    ...overrides,
  };
}

describe('streetOfBoard', () => {
  it('maps the four legal board sizes and rejects the rest', () => {
    expect(streetOfBoard(0)).toBe('preflop');
    expect(streetOfBoard(3)).toBe('flop');
    expect(streetOfBoard(4)).toBe('turn');
    expect(streetOfBoard(5)).toBe('river');
    expect(streetOfBoard(1)).toBeNull();
    expect(streetOfBoard(2)).toBeNull();
    expect(streetOfBoard(6)).toBeNull();
  });
});

describe('buildLiveHandState', () => {
  it('puts the entered pot and bet where the engine reads them', () => {
    const state = buildLiveHandState(observation());

    expect(state).not.toBeNull();
    expect(totalPot(state!)).toBe(14 * LIVE_BIG_BLIND);
    expect(amountToCall(state!, 0)).toBe(4 * LIVE_BIG_BLIND);
    expect(state!.street).toBe('flop');
    expect(state!.toAct).toBe(0);
  });

  it('offers fold, call and raise when a bet is faced', () => {
    const actions = legalActions(buildLiveHandState(observation())!);

    expect(actions.map((action) => action.type)).toEqual(['fold', 'call', 'raise']);
  });

  it('offers check and bet when the action is on hero for free', () => {
    const actions = legalActions(buildLiveHandState(observation({ toCallBb: 0 }))!);

    expect(actions.map((action) => action.type)).toEqual(['check', 'bet']);
  });

  it('keeps every villain deep enough to stay active behind the numbers', () => {
    const state = buildLiveHandState(observation({ potBb: 300, toCallBb: 150 }))!;

    for (const villain of state.players.slice(1)) {
      expect(villain.status).toBe('active');
      expect(villain.stack).toBeGreaterThan(0);
    }
  });

  it('excludes hero and board cards from the deck', () => {
    const state = buildLiveHandState(observation())!;

    expect(state.deck).toHaveLength(52 - 5);

    for (const card of [...HERO, ...state.board]) {
      expect(state.deck).not.toContain(card);
    }
  });

  it('returns null for a board mid-flop', () => {
    expect(buildLiveHandState(observation({ board: parseCards('Qh 7c') }))).toBeNull();
  });

  it('returns null when a hero card sits on the board', () => {
    expect(buildLiveHandState(observation({ board: parseCards('Ah 7c 2d') }))).toBeNull();
  });

  it('returns null outside the one-to-eight opponent range', () => {
    expect(buildLiveHandState(observation({ opponents: 0 }))).toBeNull();
    expect(buildLiveHandState(observation({ opponents: 9 }))).toBeNull();
  });

  it('returns null with no stack behind', () => {
    expect(buildLiveHandState(observation({ heroStackBb: 0 }))).toBeNull();
  });
});
