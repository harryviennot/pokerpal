/**
 * The stored row ids for the hands of the session that just finished.
 *
 * The summary talks in hand numbers, because that is what the coach recorded;
 * the replay route needs a database id. This is the bridge, and it is a hook
 * rather than a lookup because the answer involves the disk: the game never
 * waits on storage, so the last hands of a session are usually still in flight
 * when the summary mounts.
 *
 * A hand that failed to save has no id and never gets one. That is a state the
 * screen has to render, not an error to swallow — `saveState === 'error'` on the
 * game says the same thing from the other side.
 */

import { useCallback, useEffect, useState } from 'react';

import { getHandHistoryRepo } from '@/services/handHistory';

import { useGameStore } from './useGameStore';

export type SessionHandsState =
  | { status: 'loading' }
  | { status: 'error' }
  /** Nothing of this session reached the disk: there is no row to replay. */
  | { status: 'empty' }
  | { status: 'ready'; idByHandNumber: ReadonlyMap<number, number> };

export function useSessionHands(): { state: SessionHandsState; reload: () => void } {
  // Store actions, so both references are stable for the life of the store and
  // the effect below runs once rather than on every pump.
  const archiveIdle = useGameStore((state) => state.archiveIdle);
  const storedSessionId = useGameStore((state) => state.storedSessionId);
  const [state, setState] = useState<SessionHandsState>({ status: 'loading' });
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        // Before asking which session: the row is created by the first hand's
        // write, and the last hand's write may not have happened yet.
        await archiveIdle();

        const sessionId = await storedSessionId();

        if (sessionId === null) {
          if (!cancelled) {
            setState({ status: 'empty' });
          }

          return;
        }

        const repo = await getHandHistoryRepo();
        const hands = await repo.listSessionHands(sessionId);

        if (cancelled) {
          return;
        }

        setState(
          hands.length === 0
            ? { status: 'empty' }
            : {
                status: 'ready',
                idByHandNumber: new Map(hands.map((hand) => [hand.handNumber, hand.id])),
              },
        );
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
  }, [archiveIdle, storedSessionId, generation]);

  const reload = useCallback(() => setGeneration((current) => current + 1), []);

  return { state, reload };
}
