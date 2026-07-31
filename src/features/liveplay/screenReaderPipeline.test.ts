/**
 * The whole path, with nothing of ours mocked.
 *
 * Pixels are painted into an RGB buffer, the screen reader identifies the
 * cards, fusion locks them, the store adopts the hero pair and the advice
 * pipeline grades the spot. If this passes, the only thing between it and a
 * real device is the camera itself.
 */

import { formatCard, parseCard, parseCards, type Card } from '@/engine';
import { fakeTemplates, paintFrame, readScreenFrame, type PaintCard } from '@/services/vision';

import { DEFAULT_FUSION } from './fusion';
import { computeLiveAdvice } from './liveAdvice';
import { useLivePlayStore } from './useLivePlayStore';

const W = 240;
const H = 428;
const templates = fakeTemplates();

const HERO = parseCards('Ah Kh');
const FLOP = parseCards('Qc 7d 2s');
const TURN = parseCard('9s');
const RIVER = parseCard('3d');

function boardCards(cards: readonly Card[]): PaintCard[] {
  return cards.map((card, index) => ({
    rect: { x: 30 + index * 36, y: 190, w: 32, h: 45 },
    card,
  }));
}

function heroCards(cards: readonly Card[]): PaintCard[] {
  return cards.map((card, index) => ({
    rect: { x: 92 + index * 30, y: 330, w: 32, h: 45 },
    card,
  }));
}

/** Films one scene for `count` frames: paint, read, ingest. */
function film(cards: readonly PaintCard[], count: number): void {
  const frame = paintFrame({ width: W, height: H, cards });
  const detections = readScreenFrame(frame.rgb, W, H, templates);
  const { ingestFrame } = useLivePlayStore.getState();

  for (let i = 0; i < count; i++) {
    ingestFrame({ cards: detections, timestampMs: i });
  }
}

beforeEach(() => {
  useLivePlayStore.getState().reset();
});

describe('the screen reader through to advice', () => {
  it('follows a hand from the deal to the river, reading every card off the screen', () => {
    // Preflop: only the hero's own cards are face up.
    film(heroCards(HERO), DEFAULT_FUSION.lockHits);

    const dealt = useLivePlayStore.getState();

    expect(dealt.heroCards?.map(formatCard)).toEqual(['Ah', 'Kh']);
    expect(dealt.heroSource).toBe('vision');
    expect(dealt.fusion.board).toHaveLength(0);

    // Flop.
    film([...heroCards(HERO), ...boardCards(FLOP)], DEFAULT_FUSION.lockHits);

    expect(useLivePlayStore.getState().fusion.board.map(formatCard)).toEqual(['Qc', '7d', '2s']);

    // Turn, then river — one card at a time, in order.
    film([...heroCards(HERO), ...boardCards([...FLOP, TURN])], DEFAULT_FUSION.lockHits);

    expect(useLivePlayStore.getState().fusion.board).toHaveLength(4);

    film([...heroCards(HERO), ...boardCards([...FLOP, TURN, RIVER])], DEFAULT_FUSION.lockHits);

    const river = useLivePlayStore.getState();

    expect(river.fusion.board.map(formatCard)).toEqual(['Qc', '7d', '2s', '9s', '3d']);
    // The hero's cards were never mistaken for board cards.
    expect(river.fusion.board.map(formatCard)).not.toContain('Ah');
  });

  it('ends the hand when the board clears, with the hero pair still on screen', () => {
    film([...heroCards(HERO), ...boardCards(FLOP)], DEFAULT_FUSION.lockHits);

    expect(useLivePlayStore.getState().handEnded).toBe(false);

    // The board is swept; the player's own cards stay in front of them.
    film(heroCards(HERO), DEFAULT_FUSION.handEndFrames);

    expect(useLivePlayStore.getState().handEnded).toBe(true);
  });

  it("grades the spot it read, on the coach's own rubric", () => {
    film([...heroCards(HERO), ...boardCards(FLOP)], DEFAULT_FUSION.lockHits);

    const state = useLivePlayStore.getState();

    state.setPotEntry({ pot: 10, toCall: 2 });

    const observed = useLivePlayStore.getState();
    const advice = computeLiveAdvice({
      heroCards: observed.heroCards!,
      board: observed.fusion.board,
      opponents: observed.opponents,
      potBb: observed.potEntry!.pot,
      toCallBb: observed.potEntry!.toCall,
      heroStackBb: observed.heroStackBb,
    });

    expect(advice).not.toBeNull();
    expect(['fold', 'check', 'call', 'bet', 'raise']).toContain(advice!.best.type);
    // Two overcards and a backdoor draw getting 5:1 is not a fold.
    expect(advice!.best.type).not.toBe('fold');
  });

  it('reads a dark-scheme capture with noise the same way', () => {
    const cards = [...heroCards(HERO), ...boardCards(FLOP)];
    const frame = paintFrame({
      width: W,
      height: H,
      cards,
      scheme: 'dark',
      brightness: 0.9,
      noise: 5,
    });
    const detections = readScreenFrame(frame.rgb, W, H, templates);
    const { ingestFrame } = useLivePlayStore.getState();

    for (let i = 0; i < DEFAULT_FUSION.lockHits; i++) {
      ingestFrame({ cards: detections, timestampMs: i });
    }

    const state = useLivePlayStore.getState();

    expect(state.heroCards?.map(formatCard)).toEqual(['Ah', 'Kh']);
    expect(state.fusion.board.map(formatCard)).toEqual(['Qc', '7d', '2s']);
  });
});
