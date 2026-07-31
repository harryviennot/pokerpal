import { parseCard } from '@/engine';

import { DEFAULT_SCREEN_READER } from './config';
import { binarize, filterComponents, labelComponents } from './segment';
import { paintFrame, type PaintCard } from './synthetic';
import { classifyZones, type ZonedRegion } from './zones';

const W = 200;
const H = 356;
const config = DEFAULT_SCREEN_READER;

function boardCard(index: number, card: string): PaintCard {
  return { rect: { x: 27 + index * 30, y: 164, w: 26, h: 37 }, card: parseCard(card) };
}

function zonesOf(cards: readonly PaintCard[]): ZonedRegion[] {
  const frame = paintFrame({ width: W, height: H, cards });
  const mask = binarize(frame.rgb, W, H, config);
  const { singles, fans } = filterComponents(labelComponents(mask), mask.gw, mask.gh, config);

  return classifyZones(singles, fans, mask, config);
}

function count(regions: ZonedRegion[], zone: string): number {
  return regions.filter((r) => r.zone === zone).length;
}

describe('classifyZones', () => {
  it('reads a five-card mid row as the board', () => {
    const regions = zonesOf([
      boardCard(0, '8s'),
      boardCard(1, 'Kd'),
      boardCard(2, 'As'),
      boardCard(3, '2d'),
      boardCard(4, '7h'),
    ]);

    expect(count(regions, 'board')).toBe(5);
    expect(count(regions, 'hero')).toBe(0);
  });

  it('reads a three-card flop as the board', () => {
    const regions = zonesOf([boardCard(0, 'Kd'), boardCard(1, 'As'), boardCard(2, '2d')]);

    expect(count(regions, 'board')).toBe(3);
  });

  it('splits a low central fan blob into two hero cards', () => {
    const regions = zonesOf([
      boardCard(0, 'Kd'),
      boardCard(1, 'As'),
      boardCard(2, '2d'),
      { rect: { x: 77, y: 270, w: 46, h: 40 }, card: parseCard('9c') },
    ]);

    expect(count(regions, 'board')).toBe(3);
    expect(count(regions, 'hero')).toBe(2);
  });

  it('reads two low central singles as the hero pair', () => {
    const regions = zonesOf([
      { rect: { x: 82, y: 270, w: 26, h: 37 }, card: parseCard('9c') },
      { rect: { x: 112, y: 270, w: 26, h: 37 }, card: parseCard('6c') },
    ]);

    expect(count(regions, 'hero')).toBe(2);
    expect(count(regions, 'board')).toBe(0);
  });

  it('marks an opponent fan near the top edge as other, never board or hero', () => {
    const regions = zonesOf([
      boardCard(0, 'Kd'),
      boardCard(1, 'As'),
      boardCard(2, '2d'),
      { rect: { x: 8, y: 70, w: 44, h: 36 }, card: parseCard('9c') },
    ]);

    expect(count(regions, 'board')).toBe(3);
    expect(count(regions, 'hero')).toBe(0);
    expect(count(regions, 'other')).toBe(1);
  });

  it('sees nothing where the board shows dark mystery cards', () => {
    // Mystery cards are a dark gradient — below the whiteness threshold.
    const frame = paintFrame({
      width: W,
      height: H,
      cards: [],
      background: [30, 64, 180],
    });
    // Paint three dark rects where the board would be.
    for (let i = 0; i < 3; i++) {
      const x0 = 27 + i * 30;

      for (let y = 164; y < 201; y++) {
        for (let x = x0; x < x0 + 26; x++) {
          const p = (y * W + x) * 3;

          frame.rgb[p] = 40;
          frame.rgb[p + 1] = 30;
          frame.rgb[p + 2] = 60;
        }
      }
    }

    const mask = binarize(frame.rgb, W, H, config);
    const { singles, fans } = filterComponents(labelComponents(mask), mask.gw, mask.gh, config);

    expect(classifyZones(singles, fans, mask, config)).toHaveLength(0);
  });
});
