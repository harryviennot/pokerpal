/**
 * Pot construction and chip distribution.
 *
 * Two rules do all the work here. First, an unmatched bet is handed back before
 * anything is layered, so no player can have committed more than someone else
 * was able to match. That is what keeps `buildPots` free of special cases:
 * every commitment layer is guaranteed at least one eligible claimant.
 *
 * Second, side pots are layers, not exceptions. Sort the distinct commitment
 * levels ascending; each level adds a pot of `(level - previous) x (players at
 * or above it)`, claimable by the players at or above it who did not fold.
 * Folded players' chips stay in the layers they helped build.
 */

import { type Player, type Pot, type SeatIndex } from './table';

/** The subset of `Player` the pot math actually reads. */
export interface Contribution {
  seat: SeatIndex;
  committedTotal: number;
  /** False for folded and sitting-out seats: they build pots but cannot win them. */
  eligible: boolean;
}

export function toContribution(player: Player): Contribution {
  return {
    seat: player.seat,
    committedTotal: player.committedTotal,
    eligible: player.status === 'active' || player.status === 'allIn',
  };
}

/**
 * Splits total commitments into a main pot and any side pots, ordered from the
 * main pot outward. Layers nobody can claim are folded into the layer below
 * rather than being dropped, so chips are always conserved.
 */
export function buildPots(contributions: readonly Contribution[]): Pot[] {
  const levels = [...new Set(contributions.map((c) => c.committedTotal))]
    .filter((level) => level > 0)
    .sort((a, b) => a - b);

  const pots: Pot[] = [];
  let previous = 0;

  for (const level of levels) {
    const contributors = contributions.filter((c) => c.committedTotal >= level);
    const amount = (level - previous) * contributors.length;
    const eligible = contributors.filter((c) => c.eligible).map((c) => c.seat);

    previous = level;

    if (amount === 0) {
      continue;
    }

    const last = pots[pots.length - 1];

    // A layer only folded players reached — most often the blinds when everyone
    // walks. Merge it downward so the chips still reach a claimant.
    if (eligible.length === 0) {
      if (last) {
        last.amount += amount;
      } else {
        pots.push({ amount, eligible: [] });
      }
      continue;
    }

    // Consecutive layers with the same claimants are the same pot.
    if (last && sameSeats(last.eligible, eligible)) {
      last.amount += amount;
    } else {
      pots.push({ amount, eligible });
    }
  }

  return pots;
}

function sameSeats(a: readonly SeatIndex[], b: readonly SeatIndex[]): boolean {
  return a.length === b.length && a.every((seat, index) => seat === b[index]);
}

export interface UncalledBet {
  seat: SeatIndex;
  amount: number;
}

/**
 * The portion of the top commitment nobody could match, which must go back to
 * its owner before the pot is built.
 *
 * Only the single highest contributor can ever be unmatched: if two players
 * reach the same level, both are matched. Returns null when the top commitment
 * is matched or when only one player put chips in at all.
 */
export function findUncalledBet(contributions: readonly Contribution[]): UncalledBet | null {
  const committed = contributions.filter((c) => c.committedTotal > 0);

  if (committed.length === 0) {
    return null;
  }

  const sorted = [...committed].sort((a, b) => b.committedTotal - a.committedTotal);
  const top = sorted[0] as Contribution;
  const second = sorted[1];
  const matched = second ? second.committedTotal : 0;
  const excess = top.committedTotal - matched;

  return excess > 0 ? { seat: top.seat, amount: excess } : null;
}

export interface Award {
  seat: SeatIndex;
  amount: number;
  potIndex: number;
  /** True for a remainder chip handed out under the odd-chip rule. */
  oddChip: boolean;
}

/**
 * Splits one pot between its winners.
 *
 * Chips are integers, so a three-way split of 100 leaves one over. The
 * remainder goes one chip at a time to the winners nearest the button on its
 * left — the standard casino rule, and the reason `button` and `seatCount` are
 * needed here at all.
 */
export function awardPot(
  pot: Pot,
  winners: readonly SeatIndex[],
  potIndex: number,
  button: SeatIndex,
  seatCount: number,
): Award[] {
  if (winners.length === 0) {
    throw new RangeError('A pot must be awarded to at least one seat.');
  }

  const share = Math.floor(pot.amount / winners.length);
  let remainder = pot.amount - share * winners.length;

  // Order winners clockwise starting from the first seat left of the button,
  // which is who the first odd chip belongs to.
  const ordered = [...winners].sort(
    (a, b) => seatsFromButton(a, button, seatCount) - seatsFromButton(b, button, seatCount),
  );

  return ordered.map((seat) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;

    return { seat, amount: share + extra, potIndex, oddChip: extra === 1 };
  });
}

/** Distance clockwise from the button, so the seat immediately left of it is 1. */
function seatsFromButton(seat: SeatIndex, button: SeatIndex, seatCount: number): number {
  return ((seat - button + seatCount - 1) % seatCount) + 1;
}
