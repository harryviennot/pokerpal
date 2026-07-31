/**
 * How long everything takes.
 *
 * The engine resolves a whole orbit in microseconds; a table of people does not,
 * and a table that answers instantly reads as a slot machine rather than a game.
 * This module is that entire difference, and it is pure: functions from a spot to
 * a number of milliseconds, no timer within reach, so every delay in the game is
 * a value a test can assert on.
 *
 * All figures are milliseconds.
 */

import {
  amountToCall,
  type BotProfile,
  type HandEvent,
  type HandState,
  type Rng,
  type SeatIndex,
  type Street,
} from '@/engine';

/**
 * An ordinary decision, before archetype flavour: 800 to 2 600 ms.
 *
 * The bottom of the band is about as fast as a person can register a spot and
 * tap; the top is a considered fold. Flavour scales this band rather than
 * replacing it, so the shape of the distribution is the same for everyone.
 */
const BASE_MIN_MS = 800;
const BASE_MAX_MS = 2_600;

/** The long stare: 4 000 to 7 000 ms. Only for a spot that earns one. */
const BIG_MIN_MS = 4_000;
const BIG_MAX_MS = 7_000;

/**
 * How often a big spot actually gets the long stare.
 *
 * Not always, because a bot that pauses on every river tells the player exactly
 * which spots it thinks are close — the pause would become a tell.
 */
const BIG_CHANCE = 0.35;

/** Floor and ceiling after flavour, so nobody ever snaps or appears to hang. */
const FLOOR_MS = 500;
const CEILING_MS = 7_000;

/** Facing this share of your own stack is a decision, not a formality. */
const BIG_BET_FRACTION = 0.4;

/** Bounds on the tempo multiplier: a maniac at 0.55x, a rock at 1.5x. */
const FASTEST_TEMPO = 0.55;
const SLOWEST_TEMPO = 1.5;

/**
 * Presentation delay per event, so an engine burst plays out instead of landing
 * all at once. A street and a pot being pushed are the moments worth watching;
 * blinds and hole cards are just the table filling up.
 */
const REVEAL_MS: Record<HandEvent['type'], number> = {
  handStart: 0,
  blindPosted: 120,
  holeCardsDealt: 120,
  streetDealt: 900,
  actionTaken: 250,
  uncalledBetReturned: 400,
  // A revealed hand is information, not motion: each one needs long enough to
  // actually be read before the next reveal takes the eye.
  showdownHand: 1_100,
  handMucked: 250,
  potAwarded: 600,
  handEnd: 200,
};

/** The beat between a hand ending and the next one being dealt. */
export const AUTO_NEXT_HAND_MS = 4_000;

/**
 * The linger after a showdown, before the next deal.
 *
 * Twice the ordinary beat: a fold ends a hand the player already understood,
 * but a showdown leaves two or three revealed hands, a winner and a dimmed
 * board on the felt, and dealing the next hand under someone still working out
 * what beat them reads as the table snatching the cards away.
 */
export const AUTO_NEXT_SHOWDOWN_MS = 8_000;

/** How long the finished hand stays on screen before the next one is dealt. */
export function nextHandDelayFor(events: readonly HandEvent[]): number {
  return events.some((event) => event.type === 'showdownHand')
    ? AUTO_NEXT_SHOWDOWN_MS
    : AUTO_NEXT_HAND_MS;
}

/**
 * The beat before an armed action plays.
 *
 * Long enough that the player sees the action reach them and short enough that
 * arming a preselect still feels like skipping ahead.
 */
export const PRESELECT_BEAT_MS = 400;

/**
 * The pause after a street lands, measured from the last card visibly landing,
 * before anyone is shown on the clock. The table's grammar is first the card,
 * then whose move it is — a plate that lights while a card is still turning
 * muddles the two.
 */
const STREET_SETTLE_BASE_MS = 700;

/**
 * Board cards flip on `CardFlip`'s 70 ms stagger by board position, so each
 * street's last card starts moving at a different time: the flop's third card
 * at 140 ms, the turn's single card at 210, the river's at 280. The settle has
 * to absorb that, or the clock gets a shorter breath every street.
 */
const CARD_STAGGER_MS = 70;

/** Board index of the last card each street deals. Streets that deal none: -0. */
const LAST_CARD_INDEX: Record<Street, number> = {
  preflop: 0,
  flop: 2,
  turn: 3,
  river: 4,
  showdown: 0,
};

/** The full hold before the clock lights after `street` is dealt. */
export function streetSettleFor(street: Street): number {
  return STREET_SETTLE_BASE_MS + LAST_CARD_INDEX[street] * CARD_STAGGER_MS;
}

/** How long the hero has to act in real mode before the table acts for them. */
export const DECISION_CLOCK_MS = 20_000;

/** Wall-clock length of a blind level in real mode. Three minutes. */
export const LEVEL_LENGTH_MS = 180_000;

/** How long to hold `event` on screen before showing the next one. */
export function revealDelayFor(event: HandEvent): number {
  return REVEAL_MS[event.type];
}

/**
 * How long a bot sits on a decision.
 *
 * Ordinary spots land in 800–2 600 ms scaled by the archetype's tempo, which
 * puts a maniac around 500–1 500 ms and a rock or a shark around 1 000–3 200 ms.
 * A genuinely big spot — most of a stack to call, an all-in call, or the river —
 * takes 4 000–7 000 ms about a third of the time.
 *
 * `rng` must be the pacing stream, never the bot stream: a delay that stole a
 * number from the stream a decision comes off would change the decision.
 */
export function thinkDelayFor(
  profile: BotProfile | null,
  hand: HandState,
  seat: SeatIndex,
  rng: Rng,
): number {
  // Two draws whatever the spot: a fixed cost per decision keeps the pacing
  // stream aligned across a session however the hands happen to play out, which
  // is what makes a seeded test of the pump stable.
  const roll = rng.next();
  const spread = rng.next();

  if (roll < BIG_CHANCE && isBigDecision(hand, seat)) {
    return Math.round(BIG_MIN_MS + spread * (BIG_MAX_MS - BIG_MIN_MS));
  }

  const base = BASE_MIN_MS + spread * (BASE_MAX_MS - BASE_MIN_MS);

  return Math.round(clamp(base * tempoOf(profile), FLOOR_MS, CEILING_MS));
}

/**
 * The archetype's tempo, as a multiplier on base think time.
 *
 * Read off the personality's own dials rather than its name, so a new archetype
 * gets a plausible tempo for free: a high entry bar is a player who folds after
 * thinking about it, bluffing often is a player who has already decided, and
 * reading ranges is work that takes a beat. A seat with no profile — the hero's,
 * which never asks for a think delay — is average.
 */
function tempoOf(profile: BotProfile | null): number {
  if (profile === null) {
    return 1;
  }

  const tempo =
    0.85 + profile.entry * 0.25 - profile.bluff * 0.9 + (profile.readsRanges ? 0.25 : 0);

  return clamp(tempo, FASTEST_TEMPO, SLOWEST_TEMPO);
}

/**
 * Whether this is a spot a person would stop on.
 *
 * `amountToCall` is capped at the stack, so an all-in call reads as owing every
 * chip you have and clears the fraction on its own.
 */
function isBigDecision(hand: HandState, seat: SeatIndex): boolean {
  const player = hand.players[seat];

  if (!player) {
    return false;
  }

  const toCall = amountToCall(hand, seat);

  if (toCall <= 0) {
    return false;
  }

  return toCall >= player.stack * BIG_BET_FRACTION || hand.street === 'river';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
