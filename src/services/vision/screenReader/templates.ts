/**
 * Glyph templates and the pure image maths the reader matches with.
 *
 * A template is a small grayscale patch, zero-mean and unit-variance, so two
 * templates compare by a plain dot product (`ncc`). The rendered templates
 * (Skia, `renderTemplates.ts`) and the synthetic ones (`synthetic.ts`) both
 * arrive through `makeTemplate`, so the match path is identical in the app and
 * in Jest.
 *
 * Worklet-safe: no closures over mutable state, helpers above callers.
 */

export interface GlyphTemplates {
  /** 13 rank patches, indexed by rank index 0..12 for `2`..`A`. */
  ranks: readonly Float32Array[];
  /** 4 suit patches, indexed by the engine's SUITS order: c, d, h, s. */
  suits: readonly Float32Array[];
  rankW: number;
  rankH: number;
  suitW: number;
  suitH: number;
}

/** Bilinear resample of a single-channel patch to `dw × dh`. */
export function resampleBilinear(
  src: Float32Array,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Float32Array {
  'worklet';

  const out = new Float32Array(dw * dh);

  if (sw === 0 || sh === 0) {
    return out;
  }

  for (let y = 0; y < dh; y++) {
    const fy = dh === 1 ? 0 : (y * (sh - 1)) / (dh - 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const wy = fy - y0;

    for (let x = 0; x < dw; x++) {
      const fx = dw === 1 ? 0 : (x * (sw - 1)) / (dw - 1);
      const x0 = Math.floor(fx);
      const x1 = Math.min(sw - 1, x0 + 1);
      const wx = fx - x0;

      const a = src[y0 * sw + x0] ?? 0;
      const b = src[y0 * sw + x1] ?? 0;
      const c = src[y1 * sw + x0] ?? 0;
      const d = src[y1 * sw + x1] ?? 0;

      const top = a + (b - a) * wx;
      const bottom = c + (d - c) * wx;

      out[y * dw + x] = top + (bottom - top) * wy;
    }
  }

  return out;
}

/** Zero-mean, unit-variance in place. A flat patch becomes all zeros. */
export function normalizePatch(patch: Float32Array): Float32Array {
  'worklet';

  const n = patch.length;

  if (n === 0) {
    return patch;
  }

  let mean = 0;

  for (let i = 0; i < n; i++) {
    mean += patch[i] ?? 0;
  }

  mean /= n;

  let variance = 0;

  for (let i = 0; i < n; i++) {
    const d = (patch[i] ?? 0) - mean;

    variance += d * d;
  }

  const std = Math.sqrt(variance / n);

  if (std < 1e-6) {
    patch.fill(0);

    return patch;
  }

  for (let i = 0; i < n; i++) {
    patch[i] = ((patch[i] ?? 0) - mean) / std;
  }

  return patch;
}

/** Normalized cross-correlation of two equal-length normalized patches. */
export function ncc(a: Float32Array, b: Float32Array): number {
  'worklet';

  const n = Math.min(a.length, b.length);

  if (n === 0) {
    return 0;
  }

  let sum = 0;

  for (let i = 0; i < n; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }

  return sum / n;
}

/** Resample a raw patch to the canonical size and normalize it — one template. */
export function makeTemplate(
  src: Float32Array,
  sw: number,
  sh: number,
  tw: number,
  th: number,
): Float32Array {
  'worklet';

  return normalizePatch(resampleBilinear(src, sw, sh, tw, th));
}
