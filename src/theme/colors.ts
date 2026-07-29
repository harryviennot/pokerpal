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
}

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
};

export const colors: Record<ColorScheme, ColorTokens> = { light, dark };
