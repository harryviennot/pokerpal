import { useCallback, useEffect, useState } from 'react';

import { getHandHistoryRepo, type StoredHand } from '@/services/handHistory';

export type StoredHandState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'notFound' }
  | { status: 'ready'; hand: StoredHand };

/**
 * One stored hand, whole: its event log, its seats and the coach's verdicts.
 *
 * `notFound` is deliberately not `error`. A hand that is gone and a database
 * that cannot be read are different things that happened, and the screen owes
 * the player a different sentence for each.
 *
 * Takes the router's raw string and parses it here: the route file composes a
 * screen and nothing else, so the coercion — and the decision about what a
 * nonsense id means — belongs on this side of the boundary.
 */
export function useStoredHand(handId: string): { state: StoredHandState; reload: () => void } {
  const [state, setState] = useState<StoredHandState>({ status: 'loading' });
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const id = Number(handId);

    const load = async (): Promise<void> => {
      if (!Number.isInteger(id)) {
        setState({ status: 'notFound' });

        return;
      }

      try {
        const repo = await getHandHistoryRepo();
        const hand = await repo.getHand(id);

        if (!cancelled) {
          setState(hand ? { status: 'ready', hand } : { status: 'notFound' });
        }
      } catch {
        if (!cancelled) {
          setState({ status: 'error' });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [handId, generation]);

  const reload = useCallback(() => setGeneration((current) => current + 1), []);

  return { state, reload };
}
