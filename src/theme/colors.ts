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
  /** Black suits (clubs, spades). */
  suitBlack: string;
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
  suitBlack: '#1C1C1E',
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
  suitBlack: '#1C1C1E',
};

export const colors: Record<ColorScheme, ColorTokens> = { light, dark };
