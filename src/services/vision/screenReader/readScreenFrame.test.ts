import { formatCard, parseCard } from '@/engine';

import { readScreenFrame } from './readScreenFrame';
import { fakeTemplates, paintFrame, type PaintCard } from './synthetic';
import { type DetectedCard } from '../types';

const W = 240;
const H = 428;
const templates = fakeTemplates();

function boardCard(index: number, card: string): PaintCard {
  return { rect: { x: 30 + index * 36, y: 190, w: 32, h: 45 }, card: parseCard(card) };
}

function heroCard(index: number, card: string): PaintCard {
  return { rect: { x: 92 + index * 30, y: 330, w: 32, h: 45 }, card: parseCard(card) };
}

function read(cards: readonly PaintCard[], extra: Partial<Parameters<typeof paintFrame>[0]> = {}) {
  const frame = paintFrame({ width: W, height: H, cards, ...extra });

  return readScreenFrame(frame.rgb, W, H, templates);
}

function labels(detections: readonly DetectedCard[], zone: string): string[] {
  return detections
    .filter((d) => d.zone === zone)
    .sort((a, b) => a.bbox.x - b.bbox.x)
    .map((d) => formatCard(d.card));
}

describe('readScreenFrame', () => {
  it('reads a flop and the hero pair, each in its own zone', () => {
    const detections = read([
      boardCard(0, 'Kd'),
      boardCard(1, 'As'),
      boardCard(2, '2h'),
      heroCard(0, '9c'),
      heroCard(1, '6c'),
    ]);

    expect(labels(detections, 'board')).toEqual(['Kd', 'As', '2h']);
    expect(labels(detections, 'hero')).toEqual(['9c', '6c']);
  });

  it('reads a full five-card board', () => {
    const detections = read([
      boardCard(0, '8s'),
      boardCard(1, 'Kd'),
      boardCard(2, 'As'),
      boardCard(3, '2d'),
      boardCard(4, '7h'),
      heroCard(0, 'Th'),
      heroCard(1, 'Ad'),
    ]);

    expect(labels(detections, 'board')).toEqual(['8s', 'Kd', 'As', '2d', '7h']);
    expect(labels(detections, 'hero')).toEqual(['Th', 'Ad']);
  });

  it('sees nothing on an empty felt', () => {
    expect(read([])).toHaveLength(0);
  });

  it('reads through brightness and noise variance', () => {
    const detections = read([boardCard(0, 'Kd'), boardCard(1, 'As'), boardCard(2, '2h')], {
      brightness: 0.85,
      noise: 6,
    });

    expect(labels(detections, 'board')).toEqual(['Kd', 'As', '2h']);
  });

  it('reads a dark-scheme capture', () => {
    const detections = read([boardCard(0, 'Kd'), boardCard(1, 'As'), boardCard(2, '2h')], {
      scheme: 'dark',
    });

    expect(labels(detections, 'board')).toEqual(['Kd', 'As', '2h']);
  });

  it('normalizes boxes into the frame and carries confidence', () => {
    const detections = read([boardCard(0, 'Kd'), boardCard(1, 'As'), boardCard(2, '2h')]);

    for (const detection of detections) {
      expect(detection.bbox.x).toBeGreaterThanOrEqual(0);
      expect(detection.bbox.x + detection.bbox.width).toBeLessThanOrEqual(1);
      expect(detection.bbox.y).toBeGreaterThanOrEqual(0);
      expect(detection.confidence).toBeGreaterThan(0.6);
    }
  });

  it('emits at most one entry per card identity', () => {
    const detections = read([
      boardCard(0, 'Kd'),
      boardCard(1, 'As'),
      boardCard(2, '2h'),
      heroCard(0, '9c'),
      heroCard(1, '6c'),
    ]);
    const identities = detections.map((d) => d.card);

    expect(new Set(identities).size).toBe(identities.length);
  });
});
