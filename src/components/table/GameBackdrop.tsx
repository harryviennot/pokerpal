import { Canvas, LinearGradient, Path, Rect, vec } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

import { boltPaths, SHEAR, slashPaths, type Lane } from './arenaSlashes';

const LANE_OPACITY: Record<Lane, number> = { wash: 0.32, flare: 0.62, shadow: 0.5 };

/** Painted back to front: the dark slashes first, then the pale ones over them. */
const LANES: readonly Lane[] = ['shadow', 'wash', 'flare'];

/**
 * The arena: the bright blue field the table floats on.
 *
 * Skia earns its place here, and only here on this screen — a sheared multi-stop
 * gradient and a dozen diagonal slashes are not something view borders can fake.
 * It stays cheap by drawing all slashes of one tone as a single multi-contour
 * path, so the whole field is five draw calls whatever the screen size, and
 * nothing here animates.
 */
export function GameBackdrop() {
  const { colors } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const slashes = useMemo(() => slashPaths(width, height), [width, height]);
  const bolts = useMemo(() => boltPaths(width, height), [width, height]);

  const onLayout = (event: LayoutChangeEvent): void => {
    const layout = event.nativeEvent.layout;

    setSize({ width: layout.width, height: layout.height });
  };

  const tone: Record<Lane, string> = {
    wash: colors.arenaStripe,
    flare: colors.arenaStripe,
    shadow: colors.arenaBackdropDeep,
  };

  return (
    <View
      onLayout={onLayout}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.arenaBackdrop }]}>
      {width > 0 && height > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={width} height={height}>
            <LinearGradient
              start={axisEnd(width, height, true)}
              end={axisEnd(width, height, false)}
              positions={[0, 0.18, 0.42, 0.8]}
              colors={[
                colors.arenaBackdropDeep,
                colors.arenaBackdrop,
                colors.arenaAccent,
                colors.arenaStripe,
              ]}
            />
          </Rect>
          {LANES.map((lane) => (
            <Path key={lane} path={slashes[lane]} color={tone[lane]} opacity={LANE_OPACITY[lane]} />
          ))}
          <Path path={bolts} color={colors.arenaStripe} opacity={0.45} />
        </Canvas>
      )}
    </View>
  );
}

/**
 * One end of the gradient's axis.
 *
 * The light comes from the top right and falls away towards both bottom corners,
 * which is a diagonal of its own rather than the slashes' normal: the reference
 * darkens the bottom right as much as the bottom left.
 */
function axisEnd(width: number, height: number, low: boolean) {
  const norm = Math.hypot(1, SHEAR);
  const reach = low ? (-SHEAR * height) / norm : width / norm;

  return vec(reach / norm, (-SHEAR * reach) / norm);
}
