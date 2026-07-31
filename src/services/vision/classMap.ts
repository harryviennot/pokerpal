/**
 * Model class index to `Card`.
 *
 * Public playing-card detectors label their 52 classes with strings such as
 * `"10C"` or `"AS"`, listed alphabetically in the model's metadata. The decoder
 * only ever sees an index, so the mapping is resolved to a dense array once and
 * indexed in the hot path.
 */

import { InvalidCardError, parseCard, type Card } from '@/engine';

/**
 * The alphabetical 52-class list the common public card models export
 * (`10C`, `10D`, `10H`, `10S`, `2C`, … `9S`, `AC`, … `QS`).
 */
export const DEFAULT_CLASS_NAMES: readonly string[] = (() => {
  const ranks = ['10', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'J', 'K', 'Q'];
  const suits = ['C', 'D', 'H', 'S'];

  return ranks.flatMap((rank) => suits.map((suit) => `${rank}${suit}`));
})();

/**
 * Resolves a model's class-name list to an index-addressed card table.
 *
 * @throws {InvalidCardError} when a name is not a card — a model whose labels
 *   cannot be read is a build-time mistake, not a runtime condition.
 */
export function buildClassTable(names: readonly string[]): readonly Card[] {
  return names.map((name) => parseCard(name));
}

export { InvalidCardError };
