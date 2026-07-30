/**
 * Semantic color tokens, one value per color scheme.
 *
 * Values mirror Apple's system colors (UIKit semantic palette) so the app reads
 * as native in both schemes. Components reference token names only — a literal
 * hex in a component is a bug.
 */

export type ColorScheme = 'light' | 'dark';

export interface ColorTokens {
  /** Page background. */
  background: string;
  /** Grouped content sitting on `background` (cards, rows). */
  secondaryBackground: string;
  /** Content sitting on `secondaryBackground`. */
  tertiaryBackground: string;
  /** Primary text. */
  label: string;
  /** Supporting text: captions, units, hints. */
  secondaryLabel: string;
  /** De-emphasized text: disabled and placeholder states. */
  tertiaryLabel: string;
  /** Hairline separators. Prefer spacing over separators where possible. */
  separator: string;
  /** Accent for interactive elements. */
  tint: string;
  /** Profitable / correct outcomes. */
  success: string;
  /** Losing / blunder outcomes. */
  danger: string;
  /** Marginal outcomes needing attention. */
  warning: string;
  /** Poker table felt. Dark in both schemes — the table is always a dark canvas. */
  felt: string;
  /** The rail around the felt. Darker than the felt, never a border line. */
  feltRail: string;
  /** Text and chrome drawn on the felt, which is dark in both schemes. */
  onFelt: string;
  /** Card face background on the table and in the picker. */
  cardFace: string;
  /** Card back, for hole cards nobody has shown. */
  cardBack: string;
  /** Chip discs in a stack. */
  chip: string;
  /** Red suits (hearts, diamonds). */
  suitRed: string;
  /** Black suits (clubs, spades). Navy rather than pure black, like the felt art. */
  suitBlack: string;
  /** Radial felt gradient, outer stop. The felt family stays dark in both schemes. */
  feltEdge: string;
  /** Radial felt gradient, center glow. */
  feltGlow: string;
  /** The thin inset line tracing the inner stadium on the felt. */
  feltLine: string;
  /** The table rim around the felt. */
  rim: string;
  /** Highlight along the rim's top edge, for depth without a shadow. */
  rimHighlight: string;
  /** Seat pill background. */
  seatPill: string;
  /** Primary text on a seat pill. */
  onSeatPill: string;
  /** The name line on a seat pill. */
  onSeatPillMuted: string;
  /** The acting player's inverted pill. */
  seatPillActive: string;
  /** Text on the inverted pill. */
  onSeatPillActive: string;
  /** Initial-circle avatar background. */
  avatar: string;
  /** Winner gold: pill border, crown, chip gain. */
  winner: string;
  /** Shadow color behind a winning pill. */
  winnerGlow: string;
  /** Card-back pattern drawn on `cardBack`. */
  cardBackAccent: string;
  /** Face of a card outside the winning five at showdown. */
  cardFaceDimmed: string;
  /** Translucent scrim for the pot caption and winner banner on the felt. */
  feltOverlay: string;

  // The arena: the game screen's own palette. Sampled from the reference
  // design, and deliberately identical in light and dark — the felt is a lit
  // stage, and a stage that dims with the OS reads as a bug, not a preference.

  /** The blue field the table floats on. */
  arenaBackdrop: string;
  /** Deep stop of that field's gradient, for its corners and lower edge. */
  arenaBackdropDeep: string;
  /** The pale diagonal slashes across the field. */
  arenaStripe: string;
  /** Electric highlight in the field, and small accents drawn over it. */
  arenaAccent: string;

  /** Committing actions: Fold, Call, Raise. Red because they cost chips. */
  actionRed: string;
  /** `actionRed` held down. Derived, not sampled: a still frame has no pressed state. */
  actionRedPressed: string;
  /** Text on `actionRed`. */
  onActionRed: string;
  /** Non-committing controls: Check, All-in, the bet-size presets, +/−. */
  consoleGray: string;
  /** `consoleGray` held down. Derived, like `actionRedPressed`. */
  consoleGrayPressed: string;
  /** Text on `consoleGray`. */
  onConsoleGray: string;
  /** A console control that is not available at all — darker, never faded. */
  consoleDisabled: string;

  /** A seat waiting its turn. */
  pillDark: string;
  /** Text on `pillDark`. */
  onPillDark: string;
  /** The seat on the clock: inverted, so the eye finds it without an animation. */
  pillLight: string;
  /** Text on `pillLight`. */
  onPillLight: string;
  /** A seat that folded. Grey rather than transparent, so the stack stays legible. */
  pillFolded: string;

  /** The hero's own name plate. */
  platePlain: string;
  /** The hero's plate when they won the pot. */
  plateGold: string;
  /** Gold border that makes `plateGold` read as a win at a glance. */
  plateGoldBorder: string;

  /** Diamonds in the four-color deck. Clubs stay green-free: only diamonds recolor. */
  suitOrange: string;
  /** Card back, light stop. */
  cardBackRed: string;
  /** Card back, dark stop of the same gradient. */
  cardBackRedDeep: string;

  /** Translucent status chip over the felt: live equity, all-in marker, timers. */
  frostBadge: string;
  /** Text on `frostBadge`. */
  onFrostBadge: string;
  /** A seat that is all-in. Loud, because it changes what every later action means. */
  allInBadge: string;
  /** Strip behind a caption sitting on artwork, e.g. the hero's made-hand line. */
  captionScrim: string;
}

/**
 * The arena palette, shared by both schemes.
 *
 * Spread into `light` and `dark` rather than duplicated, so the two can never
 * drift apart by a hex digit.
 */
const arena = {
  arenaBackdrop: '#2249FB',
  arenaBackdropDeep: '#0418FD',
  arenaStripe: '#A3C2EE',
  arenaAccent: '#3085FD',
  actionRed: '#B51721',
  actionRedPressed: '#8E1219',
  onActionRed: '#FFFFFF',
  consoleGray: '#454858',
  consoleGrayPressed: '#363948',
  onConsoleGray: '#FFFFFF',
  consoleDisabled: '#30333D',
  pillDark: '#161A2E',
  onPillDark: '#FFFFFF',
  pillLight: '#EEEFF3',
  onPillLight: '#050512',
  pillFolded: '#6A6E7A',
  platePlain: '#EEF0F1',
  plateGold: '#E6E8EC',
  plateGoldBorder: '#E4C112',
  suitOrange: '#ED3E12',
  cardBackRed: '#EF4463',
  cardBackRedDeep: '#8B2244',
  frostBadge: 'rgba(38, 42, 60, 0.6)',
  onFrostBadge: '#FFFFFF',
  allInBadge: '#E1444E',
  captionScrim: 'rgba(45, 49, 67, 0.92)',
} as const;

const light: ColorTokens = {
  background: '#FFFFFF',
  secondaryBackground: '#F2F2F7',
  tertiaryBackground: '#FFFFFF',
  label: '#000000',
  secondaryLabel: 'rgba(60, 60, 67, 0.6)',
  tertiaryLabel: 'rgba(60, 60, 67, 0.3)',
  separator: 'rgba(60, 60, 67, 0.29)',
  tint: '#007AFF',
  success: '#34C759',
  danger: '#FF3B30',
  warning: '#FF9500',
  felt: '#0B6B3A',
  feltRail: '#08301D',
  onFelt: '#FFFFFF',
  cardFace: '#FFFFFF',
  cardBack: '#2C3E66',
  chip: '#E8ECF2',
  suitRed: '#D7263D',
  suitBlack: '#232D4B',
  feltEdge: '#1B5E55',
  feltGlow: '#3E8E5F',
  feltLine: 'rgba(255, 255, 255, 0.16)',
  rim: '#26292E',
  rimHighlight: 'rgba(255, 255, 255, 0.1)',
  seatPill: '#232D4B',
  onSeatPill: '#FFFFFF',
  onSeatPillMuted: 'rgba(255, 255, 255, 0.65)',
  seatPillActive: '#F2F4F9',
  onSeatPillActive: '#10182B',
  avatar: '#3A4A78',
  winner: '#E4B33C',
  winnerGlow: 'rgba(228, 179, 60, 0.45)',
  cardBackAccent: '#5B7BD5',
  cardFaceDimmed: '#C6C9CF',
  feltOverlay: 'rgba(0, 0, 0, 0.35)',
  ...arena,
};

const dark: ColorTokens = {
  background: '#000000',
  secondaryBackground: '#1C1C1E',
  tertiaryBackground: '#2C2C2E',
  label: '#FFFFFF',
  secondaryLabel: 'rgba(235, 235, 245, 0.6)',
  tertiaryLabel: 'rgba(235, 235, 245, 0.3)',
  separator: 'rgba(84, 84, 88, 0.65)',
  tint: '#0A84FF',
  success: '#30D158',
  danger: '#FF453A',
  warning: '#FF9F0A',
  felt: '#08492A',
  feltRail: '#04180F',
  onFelt: '#FFFFFF',
  cardFace: '#F5F5F7',
  cardBack: '#232D4B',
  chip: '#D5DAE3',
  suitRed: '#E5384C',
  suitBlack: '#2C3A63',
  feltEdge: '#154A43',
  feltGlow: '#357F54',
  feltLine: 'rgba(255, 255, 255, 0.12)',
  rim: '#1A1C20',
  rimHighlight: 'rgba(255, 255, 255, 0.07)',
  seatPill: '#1C2440',
  onSeatPill: '#FFFFFF',
  onSeatPillMuted: 'rgba(255, 255, 255, 0.6)',
  seatPillActive: '#E8ECF4',
  onSeatPillActive: '#10182B',
  avatar: '#33415F',
  winner: '#F0C24B',
  winnerGlow: 'rgba(240, 194, 75, 0.45)',
  cardBackAccent: '#5B7BD5',
  cardFaceDimmed: '#9A9DA4',
  feltOverlay: 'rgba(0, 0, 0, 0.4)',
  ...arena,
};

export const colors: Record<ColorScheme, ColorTokens> = { light, dark };
