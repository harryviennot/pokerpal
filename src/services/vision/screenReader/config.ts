/**
 * Every tunable the screen reader has, in one place.
 *
 * The reader is tuned to PokerPal's own renderer — white card faces, a
 * four-colour deck, a centred board row, a fanned hero pair at the bottom.
 * These are the knobs a device pass will actually turn; tests override them
 * with partials. Nothing here is worklet state — it is passed in per call.
 */

export interface ScreenReaderConfig {
  /** Segmentation runs on every `gridStride`-th pixel in each axis. */
  gridStride: number;

  /** Whiteness threshold is `lumaFraction × the frame's Nth-percentile luma`. */
  lumaPercentile: number;
  lumaFraction: number;
  /** Absolute floor so a dim frame cannot drag the threshold to nothing. */
  lumaFloor: number;
  /** A card pixel is near-grey: `max(r,g,b) − min(r,g,b)` below this. */
  maxChroma: number;

  /** Bounding-box area as a fraction of the frame, for a single card. */
  minCardAreaFrac: number;
  maxCardAreaFrac: number;
  /** White fill within the bbox — a card is mostly white with small glyphs. */
  minFill: number;
  /** A fanned pair overlaps, so its blob fills less of its bbox. */
  fanMinFill: number;

  /** Aspect `w/h` bands. A card is ~0.71; the hero fan blob is ~1.27. */
  cardAspectMin: number;
  cardAspectMax: number;
  fanAspectMin: number;
  fanAspectMax: number;

  /** The board row's y-centre must fall in this vertical band of the frame. */
  boardBandMin: number;
  boardBandMax: number;
  /** The hero pair sits below this fraction of the frame height. */
  heroBandMin: number;
  /** Hero singles are horizontally central within this band. */
  heroCentreMin: number;
  heroCentreMax: number;
  /** Board members share a y-centre within this fraction of a card height. */
  rowYTolerance: number;

  /**
   * The corner read windows, as fractions of the card bbox. The renderer puts
   * the rank at the top-left and the small suit pip directly beneath it, so
   * the split is positional — far steadier than trying to tell the two glyphs
   * apart by the gap between them, which either can contain internally.
   */
  rankWinW: number;
  /** Rank occupies the card's top `rankWinH` of height. */
  rankWinH: number;
  /** The pip sits between these fractions of card height. */
  pipTop: number;
  pipBottom: number;
  /** Ink test: a pixel darker than this luma reads as glyph, not card. */
  inkLuma: number;
  /** Suit-colour tiebreak: ink darker than this is a dark suit (♠♣), not ♥/♦. */
  suitDarkLuma: number;

  /** Canonical template sizes, in cells. */
  rankTplW: number;
  rankTplH: number;
  suitTplW: number;
  suitTplH: number;

  /** NCC best-minus-second margin that maps to full confidence. */
  minMargin: number;
}

export const DEFAULT_SCREEN_READER: ScreenReaderConfig = {
  gridStride: 2,

  lumaPercentile: 0.95,
  lumaFraction: 0.82,
  lumaFloor: 140,
  maxChroma: 40,

  minCardAreaFrac: 0.0012,
  maxCardAreaFrac: 0.2,
  minFill: 0.62,
  fanMinFill: 0.5,

  cardAspectMin: 0.5,
  cardAspectMax: 0.98,
  fanAspectMin: 1.0,
  fanAspectMax: 1.75,

  boardBandMin: 0.2,
  boardBandMax: 0.72,
  heroBandMin: 0.6,
  heroCentreMin: 0.28,
  heroCentreMax: 0.72,
  rowYTolerance: 0.45,

  rankWinW: 0.6,
  rankWinH: 0.39,
  pipTop: 0.39,
  pipBottom: 0.68,
  inkLuma: 120,
  suitDarkLuma: 80,

  rankTplW: 16,
  rankTplH: 20,
  suitTplW: 12,
  suitTplH: 12,

  minMargin: 0.12,
};
