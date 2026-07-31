/**
 * The real glyph templates, drawn once with the platform's own font.
 *
 * The filmed screen renders its cards in the system font (SF Pro on iOS,
 * Roboto on Android), so the templates have to be that font on that device —
 * shipping bitmaps would mean matching iOS glyphs against Android ones. Skia
 * draws each glyph offscreen at a comfortable size, the pixels come back, and
 * `makeCroppedTemplate` reduces them exactly the way the reader reduces what
 * it extracts from a frame.
 *
 * The only file in the reader that touches a native module. It runs on the JS
 * thread at startup; the plain `Float32Array`s it returns are what cross into
 * the frame worklet. Deliberately not re-exported from the vision index, so
 * nothing drags Skia into Jest.
 */

import { matchFont, Skia, type SkFont } from '@shopify/react-native-skia';

import { formatRank, RANKS, SUITS, suitSymbol } from '@/engine';

import { DEFAULT_SCREEN_READER, type ScreenReaderConfig } from './config';
import { makeCroppedTemplate, type GlyphTemplates } from './templates';

/** Drawn big, reduced later: detail lost here cannot be recovered. */
const RENDER_SIZE = 96;
const FONT_SIZE = 64;

/** The card's rank is drawn at weight 800; the pips at the default weight. */
const RANK_WEIGHT = '800';

/** One glyph's ink as a 0..1 grayscale patch, or null when Skia is unavailable. */
function drawGlyph(text: string, font: SkFont): Float32Array | null {
  const surface = Skia.Surface.MakeOffscreen(RENDER_SIZE, RENDER_SIZE);

  if (!surface) {
    return null;
  }

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();

  paint.setColor(Skia.Color('black'));
  canvas.clear(Skia.Color('white'));

  // Centred: the reader tight-crops to the ink, so only the glyph matters.
  const bounds = font.measureText(text);

  canvas.drawText(
    text,
    (RENDER_SIZE - bounds.width) / 2 - bounds.x,
    (RENDER_SIZE + bounds.height) / 2 - (bounds.y + bounds.height),
    paint,
    font,
  );
  surface.flush();

  const image = surface.makeImageSnapshot();
  const pixels = image.readPixels();

  if (!pixels) {
    return null;
  }

  // RGBA8888 → ink strength (dark = 1), the same polarity the reader extracts.
  const patch = new Float32Array(RENDER_SIZE * RENDER_SIZE);

  for (let i = 0; i < patch.length; i++) {
    const r = Number(pixels[i * 4] ?? 255);
    const g = Number(pixels[i * 4 + 1] ?? 255);
    const b = Number(pixels[i * 4 + 2] ?? 255);

    patch[i] = 1 - (r * 0.3 + g * 0.59 + b * 0.11) / 255;
  }

  return patch;
}

/**
 * Renders the 13 rank and 4 suit templates. Returns null when Skia cannot
 * give us a surface — the caller reports `unavailable` and falls back to the
 * demo feed rather than reading garbage.
 */
export function renderGlyphTemplates(
  config: ScreenReaderConfig = DEFAULT_SCREEN_READER,
): GlyphTemplates | null {
  try {
    // The platform's own system font — the same one the filmed screen draws
    // its cards with, which is the whole point of rendering at runtime.
    const rankFont = matchFont({ fontSize: FONT_SIZE, fontWeight: RANK_WEIGHT });
    const pipFont = matchFont({ fontSize: FONT_SIZE });

    const ranks: Float32Array[] = [];

    for (const rank of RANKS) {
      const patch = drawGlyph(formatRank(rank), rankFont);

      if (!patch) {
        return null;
      }

      ranks.push(
        makeCroppedTemplate(patch, RENDER_SIZE, RENDER_SIZE, config.rankTplW, config.rankTplH),
      );
    }

    const suits: Float32Array[] = [];

    for (const suit of SUITS) {
      const patch = drawGlyph(suitSymbol(suit), pipFont);

      if (!patch) {
        return null;
      }

      suits.push(
        makeCroppedTemplate(patch, RENDER_SIZE, RENDER_SIZE, config.suitTplW, config.suitTplH),
      );
    }

    return {
      ranks,
      suits,
      rankW: config.rankTplW,
      rankH: config.rankTplH,
      suitW: config.suitTplW,
      suitH: config.suitTplH,
    };
  } catch {
    // No Skia (Jest, a device without the native module): the caller shows the
    // demo feed. A reader with no templates would read noise as cards.
    return null;
  }
}
