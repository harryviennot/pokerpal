/** 4pt grid. These are the only spacing values allowed in components. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

/** Continuous corner radii. */
export const radius = {
  xs: 4,
  sm: 10,
  md: 14,
  lg: 20,
  /** Fully rounded — pills and circular controls. */
  full: 999,
} as const;

/** Minimum touch target per Apple's Human Interface Guidelines. */
export const MIN_TOUCH_TARGET = 44;
