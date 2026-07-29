import { Canvas, RadialGradient, RoundedRect, vec } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/theme';

export interface TableFeltProps {
  width: number;
  height: number;
}

/** How thick the rim around the felt is. */
export const RIM_WIDTH = spacing.md;

/** Inset of the decorative line traced on the felt, from the felt's edge. */
const LINE_INSET = spacing.xl;

/**
 * The gradient's centre sits a little above the true middle: the light source
 * reads as hanging over the table rather than under the board.
 */
const GLOW_CENTER_Y = 0.42;

/** The glow's reach, as a fraction of the table's long side. */
const GLOW_RADIUS = 0.55;

/**
 * Ceiling on the corner radius, as a fraction of the long side.
 *
 * A capsule takes half the short side, which reads as a table while the felt
 * is tall — the practice screen — and as a lozenge once it approaches square,
 * which is what the replay screen's fixed aspect ratio gives it. Capping
 * against the long side keeps the corners honest at any shape.
 */
const MAX_ROUNDNESS = 0.28;

/**
 * The outer corner radius for a table of this size.
 *
 * A capsule (half the short side) while the felt is tall, capped against the
 * long side as it approaches square so the table never rounds into a lozenge.
 */
export function tableRadius(width: number, height: number): number {
  return Math.min(Math.min(width, height) / 2, Math.max(width, height) * MAX_ROUNDNESS);
}

/**
 * The table itself: a portrait capsule — dark rim, radial-lit felt and a thin
 * traced inner line. Pure drawing on a Skia canvas; everything interactive
 * sits in sibling views above it.
 */
export function TableFelt({ width, height }: TableFeltProps) {
  const { colors } = useTheme();

  // Nothing to draw before layout reports a size; the seats handle their own
  // visibility, so the canvas can simply wait.
  if (width === 0 || height === 0) {
    return null;
  }

  const rimRadius = tableRadius(width, height);
  const feltRadius = Math.max(0, rimRadius - RIM_WIDTH);
  const lineRadius = Math.max(0, feltRadius - LINE_INSET);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <RoundedRect x={0} y={0} width={width} height={height} r={rimRadius} color={colors.rim} />
      <RoundedRect
        x={1}
        y={1}
        width={width - 2}
        height={height - 2}
        r={rimRadius - 1}
        style="stroke"
        strokeWidth={1.5}
        color={colors.rimHighlight}
      />
      <RoundedRect
        x={RIM_WIDTH}
        y={RIM_WIDTH}
        width={width - RIM_WIDTH * 2}
        height={height - RIM_WIDTH * 2}
        r={feltRadius}>
        <RadialGradient
          c={vec(width / 2, height * GLOW_CENTER_Y)}
          r={Math.max(width, height) * GLOW_RADIUS}
          colors={[colors.feltGlow, colors.feltEdge]}
        />
      </RoundedRect>
      <RoundedRect
        x={RIM_WIDTH + LINE_INSET}
        y={RIM_WIDTH + LINE_INSET}
        width={width - (RIM_WIDTH + LINE_INSET) * 2}
        height={height - (RIM_WIDTH + LINE_INSET) * 2}
        r={lineRadius}
        style="stroke"
        strokeWidth={1.5}
        color={colors.feltLine}
      />
    </Canvas>
  );
}
