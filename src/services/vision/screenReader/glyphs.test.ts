import { formatCard, parseCard, type Card } from '@/engine';

import { DEFAULT_SCREEN_READER } from './config';
import { type Rect } from './geometry';
import { readCardFace } from './glyphs';
import { fakeTemplates, paintFrame } from './synthetic';

const W = 120;
const H = 168;
const config = DEFAULT_SCREEN_READER;
const templates = fakeTemplates();

/** Paints one card filling most of the frame and reads it back. */
function readOne(
  card: Card,
  rect: Rect = { x: 20, y: 20, w: 60, h: 84 },
): ReturnType<typeof readCardFace> {
  const frame = paintFrame({ width: W, height: H, cards: [{ rect, card }] });

  return readCardFace(frame.rgb, W, H, rect, templates, config);
}

describe('readCardFace', () => {
  it('reads every card back with high confidence', () => {
    const deck = ['Ah', 'Kd', 'Qs', 'Jc', 'Th', '9d', '8s', '7c', '6h', '5d', '4s', '3c', '2h'];

    for (const label of deck) {
      const read = readOne(parseCard(label));

      expect(read).not.toBeNull();
      expect(read && formatCard(read.card)).toBe(label);
      expect(read?.confidence).toBeGreaterThan(0.6);
    }
  });

  it('distinguishes same-rank cards that differ only by suit', () => {
    // Hearts vs diamonds (colour differs) and clubs vs spades (shape must).
    expect(formatCard(readOne(parseCard('7h'))!.card)).toBe('7h');
    expect(formatCard(readOne(parseCard('7d'))!.card)).toBe('7d');
    expect(formatCard(readOne(parseCard('Ac'))!.card)).toBe('Ac');
    expect(formatCard(readOne(parseCard('As'))!.card)).toBe('As');
  });

  it('reads a hero-sized card', () => {
    const read = readOne(parseCard('Kh'), { x: 30, y: 60, w: 62, h: 88 });

    expect(read && formatCard(read.card)).toBe('Kh');
  });

  it('returns null on a blank card with no glyphs', () => {
    const rect: Rect = { x: 20, y: 20, w: 60, h: 84 };
    const frame = paintFrame({ width: W, height: H, cards: [] });

    // Paint a plain white card, no ink.
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        const p = (y * W + x) * 3;

        frame.rgb[p] = 255;
        frame.rgb[p + 1] = 255;
        frame.rgb[p + 2] = 255;
      }
    }

    expect(readCardFace(frame.rgb, W, H, rect, templates, config)).toBeNull();
  });

  it('still reads the corner when the bottom of the card is occluded', () => {
    const rect: Rect = { x: 20, y: 20, w: 60, h: 84 };
    const frame = paintFrame({ width: W, height: H, cards: [{ rect, card: parseCard('Qd') }] });

    // A grey pill over the bottom third — the name plate / equity badge.
    for (let y = rect.y + 56; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        const p = (y * W + x) * 3;

        frame.rgb[p] = 90;
        frame.rgb[p + 1] = 92;
        frame.rgb[p + 2] = 100;
      }
    }

    expect(formatCard(readCardFace(frame.rgb, W, H, rect, templates, config)!.card)).toBe('Qd');
  });

  it('survives brightness and noise variance', () => {
    const rect: Rect = { x: 20, y: 20, w: 60, h: 84 };
    const frame = paintFrame({
      width: W,
      height: H,
      cards: [{ rect, card: parseCard('Ts') }],
      brightness: 0.85,
      noise: 8,
    });

    expect(formatCard(readCardFace(frame.rgb, W, H, rect, templates, config)!.card)).toBe('Ts');
  });
});
