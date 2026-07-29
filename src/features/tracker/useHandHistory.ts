import { useCallback, useEffect, useState } from 'react';

import {
  getHandHistoryRepo,
  type HandHistoryTotals,
  type StoredHandSummary,
} from '@/services/handHistory';

/** Enough rows for a session's browsing; paging is a later slice's problem. */
const LIST_LIMIT = 100;

export type HandHistoryState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; hands: readonly StoredHandSummary[]; totals: HandHistoryTotals };

/**
 * Every stored hand, newest first, with the all-time totals.
 *
 * `reload` re-fetches without dropping to the loading state, so a refresh on
 * tab focus updates the list in place instead of flashing a spinner over it.
 */
export function useHandHistory(): { state: HandHistoryState; reload: () => void } {
  const [state, setState] = useState<HandHistoryState>({ status: 'loading' });
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const repo = await getHandHistoryRepo();
        const [hands, totals] = await Promise.all([
          repo.listHands({ limit: LIST_LIMIT }),
          repo.totals(),
        ]);

        if (!cancelled) {
          setState({ status: 'ready', hands, totals });
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
  }, [generation]);

  const reload = useCallback(() => setGeneration((current) => current + 1), []);

  return { state, reload };
}
