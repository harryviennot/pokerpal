import { useCallback, useEffect, useState } from 'react';

import { type LeakTally } from '@/engine';
import {
  getHandHistoryRepo,
  type HandHistoryTotals,
  type StoredHandSummary,
  type StoredSessionStat,
} from '@/services/handHistory';

/** Enough rows for a session's browsing; paging is a later slice's problem. */
const LIST_LIMIT = 100;

/**
 * How far back the trend looks.
 *
 * Twelve sessions is a month of regular play — long enough to show a direction,
 * short enough that a bad patch a year ago is not still on the chart. The PRD's
 * own success metric is measured over four weeks.
 */
const TREND_LIMIT = 12;

export type HandHistoryState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      hands: readonly StoredHandSummary[];
      totals: HandHistoryTotals;
      sessions: readonly StoredSessionStat[];
      leaks: readonly LeakTally[];
    };

/**
 * Everything the History tab shows: the stored hands, the all-time totals, the
 * recent sessions the trend is drawn from, and the leaks tallied across all of
 * them.
 *
 * One hook and one round of queries rather than one per section — it is a single
 * screen reading a single local database, and four independent loading states
 * over one list would only be four ways to flicker.
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
        const [hands, totals, sessions, leaks] = await Promise.all([
          repo.listHands({ limit: LIST_LIMIT }),
          repo.totals(),
          repo.listSessions({ limit: TREND_LIMIT }),
          repo.leakTotals(),
        ]);

        if (!cancelled) {
          setState({ status: 'ready', hands, totals, sessions, leaks });
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
