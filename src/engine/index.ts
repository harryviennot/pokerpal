/**
 * The poker engine's public surface.
 *
 * Pure TypeScript: no React, no Expo, no I/O, and deterministic given a seeded
 * `Rng`. Shared by the odds calculator, the bots, the coach and the tracker.
 */

export {
  allCards,
  CARD_COUNT,
  formatCard,
  formatCardPretty,
  formatRank,
  InvalidCardError,
  isRedSuit,
  makeCard,
  parseCard,
  parseCards,
  RANKS,
  rankIndexOf,
  rankOf,
  SUITS,
  suitIndexOf,
  suitOf,
  suitSymbol,
  type Card,
  type Rank,
  type Suit,
} from './cards';

export { createDeck, drawInto, hasDuplicates, remainingDeck, shuffle } from './deck';

export {
  categoryName,
  categoryOf,
  compareHands,
  evaluateHand,
  handValue,
  HandCategory,
  type HandRank,
} from './evaluator';

export { detectDraws, drawLabel, outsToEquity, type DrawInfo, type DrawType } from './draws';

export {
  enumerateEquity,
  equity,
  InvalidEquityRequestError,
  runoutCount,
  simulateEquity,
  type EquityRequest,
  type EquityResult,
  type OpponentSpec,
} from './equity';

export {
  analyzePotOdds,
  InvalidPotOddsError,
  requiredEquity,
  type CallVerdict,
  type PotOdds,
} from './potOdds';

export {
  allCombos,
  expandHandToken,
  expandRange,
  InvalidRangeError,
  presetRange,
  rangeFraction,
  type Combo,
  type RangePreset,
} from './ranges';

export { createRng, type Rng } from './rng';
