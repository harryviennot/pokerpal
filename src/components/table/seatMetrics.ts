/**
 * The fixed footprint of a seat on the felt.
 *
 * Its own module because the seat components, the bet chips and the geometry
 * that places them all need the same numbers, and routing them through
 * `TableSeat` made that file import from the components it renders.
 *
 * Sampled from the reference design at a 402-point screen width: a name plate
 * 90 points wide and 43 tall for an opponent, half again as wide for the hero,
 * whose cards and made-hand plate stack above it.
 */

/** Width of an opponent's plate, and of the box the geometry positions. */
export const SEAT_WIDTH = 96;

/** Height of that box: cards peeking over the plate, plus the plate. */
export const SEAT_HEIGHT = 68;

/** The hero's plate is wider — it carries a name, a stack and a hand caption. */
export const HERO_SEAT_WIDTH = 128;

/** And taller, because the hero's cards are dealt face up and full size. */
export const HERO_SEAT_HEIGHT = 116;

/** Height of the name plate itself. The geometry anchors seats by its centre. */
export const PILL_HEIGHT = 44;

/** Diameter of the dealer button disc. */
export const BUTTON_SIZE = 26;

/** How far the cards behind a plate rise above its top edge. */
export const CARD_PEEK = 26;
