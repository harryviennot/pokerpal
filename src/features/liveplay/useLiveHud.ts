/**
 * The numbers on the LivePlay HUD, from the store's observed state.
 *
 * Tier 1 needs only cards: equity (chunked, off the frame budget), outs and
 * the draw's name. Tier 2 — the recommendation — additionally needs the pot
 * entry, so `observation` stays null until the player has tapped one in.
 */

import { useMemo } from 'react';

import {
  detectDraws,
  drawLabel,
  formatCard,
  requiredEquity,
  type Card,
  type EquityRequest,
  type Street,
} from '@/engine';
import { useChunkedEquity } from '@/hooks/useChunkedEquity';

import { streetOfBoard, type LiveObservation } from './liveHandState';
import { useLivePlayStore } from './useLivePlayStore';

export interface LiveHud {
  street: Street | null;
  board: readonly Card[];
  heroCards: readonly [Card, Card] | null;
  /** Hero equity vs `opponents` unknown hands, 0 to 1, or null while unknowable. */
  equity: number | null;
  outCount: number;
  drawName: string | null;
  /** Equity the entered price demands, or null without a pot entry. */
  requiredEquity: number | null;
  /** Tier 2 input; null until hero cards and a pot entry both exist. */
  observation: LiveObservation | null;
}

export function useLiveHud(): LiveHud {
  const heroCards = useLivePlayStore((state) => state.heroCards);
  const board = useLivePlayStore((state) => state.fusion.board);
  const opponents = useLivePlayStore((state) => state.opponents);
  const potEntry = useLivePlayStore((state) => state.potEntry);
  const heroStackBb = useLivePlayStore((state) => state.heroStackBb);

  const street = streetOfBoard(board.length);
  const gradable = heroCards !== null && street !== null;

  const key = gradable
    ? `${heroCards.map(formatCard).join('')}|${board.map(formatCard).join('')}|${opponents}`
    : '';
  const requests: readonly EquityRequest[] | null = gradable
    ? [
        {
          hero: heroCards,
          board,
          opponents: Array.from({ length: opponents }, () => ({ kind: 'random' }) as const),
        },
      ]
    : null;

  const equity = useChunkedEquity(key, requests)[0] ?? null;

  const draws = useMemo(
    () => (gradable ? detectDraws(heroCards, board) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const observation: LiveObservation | null =
    gradable && potEntry
      ? {
          heroCards,
          board,
          opponents,
          potBb: potEntry.pot,
          toCallBb: potEntry.toCall,
          heroStackBb,
        }
      : null;

  const firstDraw = draws?.draws[0];

  return {
    street,
    board,
    heroCards,
    equity,
    outCount: draws?.outCount ?? 0,
    drawName: firstDraw === undefined ? null : drawLabel(firstDraw),
    requiredEquity:
      potEntry && potEntry.toCall > 0 ? requiredEquity(potEntry.pot, potEntry.toCall) : null,
    observation,
  };
}
