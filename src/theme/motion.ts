/**
 * Spring presets for the table's motion, named by what they animate.
 *
 * All UI motion is a reanimated spring (CLAUDE.md bans linear timing) and
 * settles in roughly 150–300 ms. Components pick a preset by name; raw
 * damping/stiffness numbers in a component are a bug, like a hex color.
 */

export interface SpringPreset {
  damping: number;
  stiffness: number;
  mass: number;
}

export const springs = {
  /** Card deal and reveal. */
  deal: { damping: 22, stiffness: 260, mass: 1 },
  /** A bet chip arriving in front of a seat, or sliding to the pot. */
  chip: { damping: 20, stiffness: 220, mass: 1 },
  /** The pot amount ticking up. */
  pulse: { damping: 14, stiffness: 300, mass: 0.8 },
  /** The winner's gold glow fading in. */
  glow: { damping: 26, stiffness: 160, mass: 1 },
  /**
   * A card turning face up. Stiffer and lighter than `deal`: a flip that
   * overshoots looks like the card bounced off the felt.
   */
  flip: { damping: 18, stiffness: 320, mass: 0.9 },
  /**
   * A notice arriving over the felt — the coach's verdict, an all-in badge.
   * Slower and softer, so it announces itself without stealing the eye from a
   * decision in progress.
   */
  notify: { damping: 24, stiffness: 200, mass: 1 },
} as const satisfies Record<string, SpringPreset>;

export type SpringName = keyof typeof springs;
