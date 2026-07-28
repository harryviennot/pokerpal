/**
 * Opponent starting-hand ranges.
 *
 * A range is expressed in the usual shorthand — `AKs` (suited), `AKo`
 * (offsuit), `TT` (pair) — and expanded into concrete two-card combinations for
 * the simulator. Three presets ship for the calculator; a custom grid comes
 * later (PRD §A).
 */

import { makeCard, RANKS, SUITS, type Card, type Rank } from './cards';

export type RangePreset = 'tight' | 'standard' | 'loose';

export type Combo = readonly [Card, Card];

export class InvalidRangeError extends Error {
  constructor(token: string) {
    super(`Not a starting hand: "${token}". Expected forms like AA, AKs, AKo or A5s.`);
    this.name = 'InvalidRangeError';
  }
}

const RANK_BY_LABEL: Record<string, Rank> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

/**
 * Expands one shorthand token into every matching combination.
 *
 * A pair has 6 combos, a suited hand 4, an offsuit hand 12.
 *
 * @throws {InvalidRangeError} on malformed input.
 */
export function expandHandToken(token: string): Combo[] {
  const trimmed = token.trim().toUpperCase();
  const match = /^([2-9TJQKA])([2-9TJQKA])([SO])?$/.exec(trimmed);

  if (!match) {
    throw new InvalidRangeError(token);
  }

  const high = RANK_BY_LABEL[match[1] as string] as Rank;
  const low = RANK_BY_LABEL[match[2] as string] as Rank;
  const suitedness = match[3];

  if (high === low) {
    if (suitedness) {
      throw new InvalidRangeError(token);
    }

    const combos: Combo[] = [];

    for (let a = 0; a < SUITS.length; a++) {
      for (let b = a + 1; b < SUITS.length; b++) {
        combos.push([makeCard(high, SUITS[a]!), makeCard(low, SUITS[b]!)]);
      }
    }

    return combos;
  }

  if (!suitedness) {
    throw new InvalidRangeError(token);
  }

  const combos: Combo[] = [];

  if (suitedness === 'S') {
    for (const suit of SUITS) {
      combos.push([makeCard(high, suit), makeCard(low, suit)]);
    }

    return combos;
  }

  for (const highSuit of SUITS) {
    for (const lowSuit of SUITS) {
      if (highSuit !== lowSuit) {
        combos.push([makeCard(high, highSuit), makeCard(low, lowSuit)]);
      }
    }
  }

  return combos;
}

/** Expands a whitespace- or comma-separated list of tokens. */
export function expandRange(tokens: string): Combo[] {
  const parts = tokens
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.flatMap(expandHandToken);
}

/**
 * Preset ranges, roughly calibrated to the player types in PRD §B.
 *
 * `tight` is a nitty ~4% range (The Rock), `standard` a solid ~13%
 * tight-aggressive range, and `loose` a station-ish ~41% range. These are
 * teaching approximations, not solver output.
 */
const PRESET_TOKENS: Record<RangePreset, string> = {
  tight: 'AA KK QQ JJ TT AKs AQs AKo',
  standard:
    'AA KK QQ JJ TT 99 88 77 66 55 ' +
    'AKs AQs AJs ATs A9s A5s A4s KQs KJs KTs QJs QTs JTs T9s 98s 87s 76s ' +
    'AKo AQo AJo KQo',
  loose:
    'AA KK QQ JJ TT 99 88 77 66 55 44 33 22 ' +
    'AKs AQs AJs ATs A9s A8s A7s A6s A5s A4s A3s A2s ' +
    'KQs KJs KTs K9s K8s K7s QJs QTs Q9s Q8s JTs J9s J8s T9s T8s 98s 97s 87s 86s 76s 65s 54s ' +
    'AKo AQo AJo ATo A9o A8o A7o A6o A5o A4o A3o A2o ' +
    'KQo KJo KTo K9o K8o QJo QTo Q9o JTo J9o T9o T8o 98o 87o 76o',
};

const presetCache = new Map<RangePreset, Combo[]>();

/** All combinations in a preset range. Cached — expansion is pure. */
export function presetRange(preset: RangePreset): Combo[] {
  const cached = presetCache.get(preset);

  if (cached) {
    return cached;
  }

  const combos = expandRange(PRESET_TOKENS[preset]);

  presetCache.set(preset, combos);

  return combos;
}

/** The 1326 possible starting hands, for reference and testing. */
export function allCombos(): Combo[] {
  const combos: Combo[] = [];
  const cards: Card[] = RANKS.flatMap((rank) => SUITS.map((suit) => makeCard(rank, suit)));

  for (let a = 0; a < cards.length; a++) {
    for (let b = a + 1; b < cards.length; b++) {
      combos.push([cards[a] as Card, cards[b] as Card]);
    }
  }

  return combos;
}

/** Share of all starting hands a range covers, 0 to 1. */
export function rangeFraction(combos: readonly Combo[]): number {
  return combos.length / 1326;
}
