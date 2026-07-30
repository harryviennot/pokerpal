import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { arenaFrame } from './tableArt';

export interface TableFeltProps {
  width: number;
  height: number;
}

// Metro resolves asset paths at build time, so the artwork has to be required
// rather than imported: TypeScript has no module declaration for `.png`.
const ARENA = require<ImageSourcePropType>('@/assets/images/table-arena.png');

/**
 * The table itself: the arena artwork, placed so its capsule fills this box.
 *
 * A plain `<Image>` rather than Skia. The art's only opaque pixels are the
 * capsule and its drop shadow, so there is nothing to clip or mask — it
 * composites straight onto the backdrop — and React Native decodes the PNG
 * synchronously from the bundle, where Skia's `useImage` would hand back null on
 * the first frame and flash an empty felt on every mount. Skia is still the
 * right tool one layer down, for the backdrop's gradient.
 *
 * The frame is deliberately larger than the box and starts at negative offsets
 * (see `arenaFrame`), so the shadow can hang outside: the container must not
 * clip.
 */
export function TableFelt({ width, height }: TableFeltProps) {
  if (width <= 0 || height <= 0) {
    return null;
  }

  const frame = arenaFrame({ width, height });

  return (
    <View style={[styles.capsule, { width, height }]} pointerEvents="none">
      <Image source={ARENA} resizeMode="stretch" style={[styles.art, frame]} />
    </View>
  );
}

const styles = StyleSheet.create({
  capsule: {
    // Out of the flow: the felt is a layer, not a block. In the flow it would
    // push every seat wrapper its own height down the screen — the seats are
    // zero-height flow children whose absolute contents hang off them.
    position: 'absolute',
    left: 0,
    top: 0,
    // The drop shadow baked into the art reaches well past the capsule; clipping
    // it would leave the table sitting on a hard edge.
    overflow: 'visible',
  },
  art: {
    position: 'absolute',
  },
});
