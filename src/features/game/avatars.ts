/**
 * The faces at the table.
 *
 * Ten portraits, spelled out one `require` at a time: Metro resolves asset
 * paths at build time, so a loop or a template string would leave the bundle
 * without the images. The list is the only place that knows how many there are.
 */

import { type ImageSourcePropType } from 'react-native';

import { type Rng } from '@/engine';

export const AVATARS: readonly ImageSourcePropType[] = [
  require<ImageSourcePropType>('@/assets/avatars/avatar1.webp'),
  require<ImageSourcePropType>('@/assets/avatars/avatar2.webp'),
  require<ImageSourcePropType>('@/assets/avatars/avatar3.webp'),
  require<ImageSourcePropType>('@/assets/avatars/avatar4.webp'),
  require<ImageSourcePropType>('@/assets/avatars/avatar5.webp'),
  require<ImageSourcePropType>('@/assets/avatars/avatar6.webp'),
  require<ImageSourcePropType>('@/assets/avatars/avatar7.webp'),
  require<ImageSourcePropType>('@/assets/avatars/avatar8.webp'),
  require<ImageSourcePropType>('@/assets/avatars/avatar9.webp'),
  require<ImageSourcePropType>('@/assets/avatars/avatar10.webp'),
];

/**
 * `count` distinct indices into `AVATARS`, in dealt order.
 *
 * Two players wearing the same face at one table would be a bug the player
 * reads as the same opponent sitting twice, so the draw is a partial
 * Fisher-Yates over the index list rather than `count` independent picks.
 *
 * A table cannot seat more players than there are faces, so `count` above
 * `AVATARS.length` is CLAMPED to `AVATARS.length` — the caller gets fewer
 * indices than it asked for, never a repeat. Values below zero yield none.
 *
 * `rng` is the engine's seeded `Rng`, so a replayed session seats the same
 * faces in the same chairs.
 */
export function drawAvatars(count: number, rng: Rng): readonly number[] {
  const wanted = Math.min(Math.max(Math.floor(count), 0), AVATARS.length);
  const pool = AVATARS.map((_, index) => index);

  for (let i = 0; i < wanted; i++) {
    const j = i + rng.nextInt(pool.length - i);
    const swap = pool[i];
    const other = pool[j];

    // `noUncheckedIndexedAccess` makes both reads optional; neither can be
    // undefined here, and asserting that beats a non-null assertion.
    if (swap === undefined || other === undefined) {
      break;
    }

    pool[i] = other;
    pool[j] = swap;
  }

  return pool.slice(0, wanted);
}
