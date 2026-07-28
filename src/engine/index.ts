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
  potRaiseTo,
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

export {
  describeEvent,
  type BlindKind,
  type HandEvent,
  type LoggedAction,
  type SeatIndex,
  type SeatNamer,
  type Street,
} from './events';

export {
  activePlayers,
  amountToCall,
  contestingPlayers,
  IllegalActionError,
  InvalidTableError,
  isHandOver,
  nextSeat,
  playerAt,
  totalPot,
  type Action,
  type ActionType,
  type Blinds,
  type HandState,
  type LegalAction,
  type Player,
  type PlayerStatus,
  type Pot,
  type TableConfig,
} from './table';

export {
  isBettingRoundClosed,
  isLegalAction,
  legalActions,
  nextToAct,
  type BettingResult,
} from './betting';

export {
  awardPot,
  buildPots,
  findUncalledBet,
  toContribution,
  type Award,
  type Contribution,
  type UncalledBet,
} from './pots';

export { resolveShowdown, type ShowdownEntry, type ShowdownResult } from './showdown';

export { bigBlindSeat, dealStreet, nextStreet, openHand } from './deal';

export { applyAction, dealHand, startHand } from './hand';

export {
  replayHand,
  snapshotPot,
  snapshotToCall,
  type ReplayFrame,
  type ReplayInput,
  type ReplaySeat,
  type TableSnapshot,
} from './replay';

export {
  currentBlinds,
  finishHand,
  isSessionOver,
  sessionWinner,
  startNextHand,
  startSession,
  type BlindLevel,
  type HandRecord,
  type SessionConfig,
  type SessionSeat,
  type SessionState,
  type TableStyle,
} from './session';

export { alwaysCall, alwaysFold, bySeat, playUntilSeat, type BotPolicy } from './bots';

export {
  ARCHETYPES,
  CALLING_STATION,
  MANIAC,
  makeBot,
  ROCK,
  SHARK,
  TAG,
  type BotOptions,
  type BotProfile,
} from './archetypes';

export {
  chenScore,
  modelOpponents,
  strengthOf,
  type OpponentModel,
  type RangeModelOptions,
} from './rangeModel';

export { simulateMatch, type MatchConfig, type MatchResult } from './simulate';
