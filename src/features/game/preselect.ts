/**
 * What an action armed before its turn becomes when the turn arrives.
 *
 * The whole point of a preselect is a table that stays playable when it is
 * moving fast, so the rules here are about surprise rather than convenience: an
 * armed action that the table has changed the meaning of is dropped, never
 * translated into something the player did not ask for.
 */

import { legalActions, type Action, type HandState } from '@/engine';

import { type Preselect } from './types';

/**
 * The action `preselect` plays in `hand`, or null when the table invalidated it.
 *
 * - `checkFold` takes a free check and folds when there is a price. Asking for
 *   both is what makes it the one that never needs clearing.
 * - `check` is only ever a check. If someone raised, checking is not on offer
 *   any more, and the answer is null: turning it into a fold would throw away
 *   the hero's hand as a side effect of a bet they have not seen yet.
 * - `callAny` pays whatever it costs, and when it costs nothing a check is the
 *   same thing.
 */
export function resolvePreselect(preselect: Preselect, hand: HandState): Action | null {
  const legal = legalActions(hand);
  const canCheck = legal.some((action) => action.type === 'check');

  if (canCheck) {
    return { type: 'check' };
  }

  switch (preselect) {
    case 'checkFold':
      return legal.some((action) => action.type === 'fold') ? { type: 'fold' } : null;
    case 'check':
      return null;
    case 'callAny':
      return legal.some((action) => action.type === 'call') ? { type: 'call' } : null;
  }
}
