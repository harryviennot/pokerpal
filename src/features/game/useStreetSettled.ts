import { useEffect, useState } from 'react';

import { type HandEvent } from '@/engine';

import { streetSettleFor } from './pacing';

/**
 * False while a just-revealed street card is still landing.
 *
 * The engine names the next actor in the same tick that deals a street, which
 * would light their plate while the card is mid-turn. Holding the clock for
 * `streetSettleFor(street)` keeps the sequence the eye expects: first the
 * card, then whose move it is — and gives the flop's three cards and a lone
 * turn card each their own length of hold.
 */
export function useStreetSettled(event: HandEvent | null): boolean {
  const [seen, setSeen] = useState(event);
  const [settled, setSettled] = useState(event?.type !== 'streetDealt');

  // The reset-while-rendering pattern: a new event re-arms (or clears) the
  // hold in the same render it arrives, without an effect's extra commit.
  if (event !== seen) {
    setSeen(event);
    setSettled(event?.type !== 'streetDealt');
  }

  useEffect(() => {
    if (settled || seen?.type !== 'streetDealt') {
      return;
    }

    const timer = setTimeout(() => setSettled(true), streetSettleFor(seen.street));

    return () => clearTimeout(timer);
  }, [settled, seen]);

  return settled;
}
