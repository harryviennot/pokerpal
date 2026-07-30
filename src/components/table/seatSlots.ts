/**
 * Where seats sit on the capsule, one hand-placed table per player count.
 *
 * An ellipse is the obvious rule and the wrong one: the felt is a tall capsule,
 * so an evenly spaced ring drops seats onto the straight sides where there is
 * nothing to sit against, and squeezes the top pair into the narrow cap. The
 * reference design instead hugs the two long edges — hero pinned bottom centre,
 * opponents stepping down the sides — so these are slot tables, not a formula.
 *
 * Every position is a fraction of the capsule's own box, so one table serves a
 * phone and the tracker's smaller felt. Values for the two- and three-handed
 * tables are measured off the reference screenshots; the rest extend the same
 * lanes outward. Order runs clockwise from the hero, which is the order the
 * action moves: the seat to the hero's left is the one on the screen's left.
 */

export interface Point {
  x: number;
  y: number;
}

export interface SeatSlot {
  /** Centre of the seat's name plate. */
  readonly seat: Point;
  /** Centre of the chips this seat pushes out, always nearer the middle. */
  readonly bet: Point;
  /** Centre of the dealer button when this seat has it. */
  readonly button: Point;
}

/** The mirror of a left-hand slot. Symmetry by construction, not by eye. */
function mirror(slot: SeatSlot): SeatSlot {
  return {
    seat: { x: 1 - slot.seat.x, y: slot.seat.y },
    bet: { x: 1 - slot.bet.x, y: slot.bet.y },
    button: { x: 1 - slot.button.x, y: slot.button.y },
  };
}

/** Bottom centre, where the player's own chair always is. */
const HERO: SeatSlot = {
  seat: { x: 0.5, y: 0.97 },
  bet: { x: 0.5, y: 0.697 },
  button: { x: 0.334, y: 0.727 },
};

/**
 * Left side, below the board — only reached once the table is seven-handed.
 *
 * Held above the bottom cap: any lower and the capsule has started to curve
 * away under the plate.
 */
const LOW: SeatSlot = {
  seat: { x: 0.13, y: 0.74 },
  bet: { x: 0.34, y: 0.71 },
  button: { x: 0.3, y: 0.78 },
};

/** Left side, just above the board. */
const MID: SeatSlot = {
  seat: { x: 0.13, y: 0.42 },
  bet: { x: 0.33, y: 0.43 },
  button: { x: 0.29, y: 0.375 },
};

/** Left side, where the reference puts the first opponent. */
const UPPER: SeatSlot = {
  seat: { x: 0.13, y: 0.267 },
  bet: { x: 0.347, y: 0.259 },
  button: { x: 0.304, y: 0.222 },
};

/** Into the top cap, where the capsule narrows and the seat must come inboard. */
const SHOULDER: SeatSlot = {
  seat: { x: 0.24, y: 0.15 },
  bet: { x: 0.36, y: 0.24 },
  button: { x: 0.33, y: 0.105 },
};

/** Further up the cap still, for the nine-handed table's four-a-side. */
const CREST: SeatSlot = {
  seat: { x: 0.32, y: 0.135 },
  bet: { x: 0.4, y: 0.235 },
  button: { x: 0.395, y: 0.09 },
};

/** Top centre, directly opposite the hero. */
const TOP: SeatSlot = {
  seat: { x: 0.5, y: 0.125 },
  bet: { x: 0.5, y: 0.235 },
  button: { x: 0.4, y: 0.085 },
};

/** The fewest and the most players the engine will seat. */
export const MIN_SEATS = 2;
export const MAX_SEATS = 9;

const TABLES: Record<number, readonly SeatSlot[]> = {
  2: [HERO, UPPER],
  3: [HERO, UPPER, mirror(UPPER)],
  4: [HERO, UPPER, TOP, mirror(UPPER)],
  5: [HERO, MID, SHOULDER, mirror(SHOULDER), mirror(MID)],
  6: [HERO, MID, SHOULDER, TOP, mirror(SHOULDER), mirror(MID)],
  7: [HERO, LOW, MID, SHOULDER, mirror(SHOULDER), mirror(MID), mirror(LOW)],
  8: [HERO, LOW, MID, SHOULDER, TOP, mirror(SHOULDER), mirror(MID), mirror(LOW)],
  9: [HERO, LOW, MID, UPPER, CREST, mirror(CREST), mirror(UPPER), mirror(MID), mirror(LOW)],
};

/**
 * The slot for a seat, given whose eyes the table is drawn through.
 *
 * `count` is every chair at the table, including ones sitting out: a busted
 * player leaves a gap rather than shuffling everyone else round the felt.
 * Counts outside the engine's range clamp, and a step past the end of a clamped
 * table falls back to the last slot rather than returning nothing.
 */
export function slotFor(seat: number, heroSeat: number, count: number): SeatSlot {
  const chairs = Math.max(1, Math.round(count));
  const seated = Math.min(Math.max(chairs, MIN_SEATS), MAX_SEATS);
  // `Record` lookups come back optional under `noUncheckedIndexedAccess`;
  // neither of these reads can miss, and defaulting beats asserting.
  const slots = TABLES[seated] ?? [HERO];
  const step = (((seat - heroSeat) % chairs) + chairs) % chairs;

  return slots[Math.min(step, slots.length - 1)] ?? HERO;
}
