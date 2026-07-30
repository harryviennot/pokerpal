/**
 * The bet sizes the console offers, and what each one is worth.
 *
 * Pure arithmetic over the band `legalActions` handed out, so nothing on the
 * console has to do maths and every size can be checked without rendering
 * anything. Amounts are TOTAL street commitments — the `to` an `Action` carries —
 * because that is what the engine takes and what the button shows.
 *
 * Four presets, largest first, as the reference lays them out. The two smaller
 * ones change vocabulary with the street, because players do: before the flop a
 * raise is quoted in big blinds ("to three big blinds"), and after it in
 * fractions of the pot. Quoting a preflop open as a pot fraction would be
 * arithmetically fine and unreadable at the table.
 */

import { potRaiseTo, type LegalAction, type Street } from '@/engine';

/**
 * The one legal action that carries a band rather than an amount.
 *
 * Named here because this module owns the band's vocabulary: `min` and `max` come
 * straight off it, and the console needs to narrow a `LegalAction` down to it
 * before it can ask for sizes.
 */
export type RaiseAction = Extract<LegalAction, { min: number }>;

/** Narrows a legal action to the bet or raise, which are the same shape. */
export function isRaise(action: LegalAction): action is RaiseAction {
  return action.type === 'bet' || action.type === 'raise';
}

export type BetPresetId = 'allIn' | 'pot' | 'large' | 'small';

export interface BetPreset {
  id: BetPresetId;
  /**
   * The total street commitment, deliberately UNCLAMPED: the reference greys a
   * size the rules will not take rather than quietly nudging it to the minimum,
   * so the player can see why a third of the pot is not on offer.
   */
  amount: number;
  /** The caption under the amount. Null for the shove, whose name is the button. */
  caption: string | null;
  /** False when `amount` falls outside the legal band. */
  enabled: boolean;
}

export interface BetPresetInput {
  /** Every chip wagered this hand, the hero's own included. */
  pot: number;
  /** What the hero owes to call. Zero when checking is free. */
  toCall: number;
  /** What the hero has already pushed out on this street. */
  committed: number;
  bigBlind: number;
  /** Smallest legal total commitment, straight from `legalActions`. */
  min: number;
  /** The hero's whole stack, in the same total-commitment terms. */
  max: number;
  street: Street;
}

/** Opens offered before the flop, as multiples of the big blind, largest first. */
const OPEN_MULTIPLES: readonly { id: BetPresetId; multiple: number }[] = [
  { id: 'large', multiple: 3 },
  { id: 'small', multiple: 2.5 },
];

/** Sizes offered after the flop, as fractions of the pot, largest first. */
const POT_FRACTIONS: readonly { id: BetPresetId; fraction: number }[] = [
  { id: 'large', fraction: 0.65 },
  { id: 'small', fraction: 0.35 },
];

/**
 * The four sizes on offer, in the order the console stacks them.
 *
 * The shove is `max` by definition, so it is always legal whenever a raise is —
 * and it carries no caption, because "all in" is the amount.
 */
export function betPresets(input: BetPresetInput): readonly BetPreset[] {
  const { pot, toCall, committed, min, max } = input;

  return [
    { id: 'allIn' as const, amount: max, caption: null },
    { id: 'pot' as const, amount: potRaiseTo(1, pot, toCall, committed), caption: 'Pot' },
    ...sizesFor(input),
  ].map((preset) => ({ ...preset, enabled: preset.amount >= min && preset.amount <= max }));
}

/** The two smaller sizes, in the street's own vocabulary. */
function sizesFor({
  street,
  bigBlind,
  pot,
  toCall,
  committed,
}: BetPresetInput): readonly { id: BetPresetId; amount: number; caption: string }[] {
  if (street === 'preflop') {
    return OPEN_MULTIPLES.map(({ id, multiple }) => ({
      id,
      // A raise "to 3bb" is a total, not an increment on the blind: the point of
      // the preflop vocabulary is that it does not move with the pot.
      amount: Math.round(multiple * bigBlind),
      caption: `x${multiple.toFixed(1)}`,
    }));
  }

  return POT_FRACTIONS.map(({ id, fraction }) => ({
    id,
    amount: potRaiseTo(fraction, pot, toCall, committed),
    caption: `${Math.round(fraction * 100)}%`,
  }));
}

/**
 * A pending raise nudged by `step` chips and kept inside the legal band.
 *
 * Clamping rather than refusing is what makes the stepper feel right: the size
 * walks up to the shove and stops there instead of going dead a blind short.
 */
export function stepRaise(amount: number, step: number, min: number, max: number): number {
  return clampToBand(amount + step, min, max);
}

/** `amount` held inside the band `legalActions` gave, so no tap can be illegal. */
export function clampToBand(amount: number, min: number, max: number): number {
  return Math.min(Math.max(amount, min), max);
}
