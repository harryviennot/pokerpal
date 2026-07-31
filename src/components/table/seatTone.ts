/**
 * What colour a seat's name plate is, and what it says on its second line.
 *
 * Pure, and separate from the component, because the plate's four states are the
 * part of the table most likely to regress: the reference distinguishes waiting,
 * on the clock, folded and winner by colour alone, and a plate that shows the
 * wrong one silently misinforms the player about whose turn it is.
 */

import { type ReplaySeat } from '@/engine';
import { type Theme } from '@/hooks/useTheme';
import { formatChips } from '@/utils/format';

export type SeatState = 'waiting' | 'acting' | 'folded' | 'winner';

export interface SeatTone {
  state: SeatState;
  background: string;
  /** Text colour for both lines of the plate. */
  ink: string;
  /** Border colour for the plate. */
  backgroundBorder: string;
}

/**
 * The plate's state and colours.
 *
 * Winning outranks everything — a seat that folded can still be handed the pot
 * when everyone behind it folded too — and folding outranks being on the clock,
 * because the frame that shows a fold still names its seat as the actor.
 */
export function seatTone(seat: ReplaySeat, active: boolean, colors: Theme['colors']): SeatTone {
  if (seat.won > 0) {
    return {
      state: 'winner',
      background: colors.plateGold,
      backgroundBorder: colors.plateGoldBorder,
      ink: colors.onPillLight,
    };
  }

  if (seat.status === 'folded' || seat.status === 'sittingOut') {
    return {
      state: 'folded',
      background: colors.pillDark,
      backgroundBorder: colors.pillDarkBorder,
      ink: colors.onPillFolded,
    };
  }

  if (active) {
    return {
      state: 'acting',
      background: colors.pillLight,
      backgroundBorder: colors.pillLightBorder,
      ink: colors.onPillLight,
    };
  }

  return {
    state: 'waiting',
    background: colors.pillDark,
    backgroundBorder: colors.pillDarkBorder,
    ink: colors.onPillDark,
  };
}

/** The plate's second line: chips gained, all in, or the stack behind. */
export function stackLine(seat: ReplaySeat): string {
  if (seat.won > 0) {
    return `+${formatChips(seat.won)}`;
  }

  return seat.stack === 0 && seat.status === 'allIn' ? 'All-in' : formatChips(seat.stack);
}
