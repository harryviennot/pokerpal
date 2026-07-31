/**
 * Whether the player has read what LivePlay is for — and is not for.
 *
 * PRD A4 requires the intended-use framing inside the feature at first launch,
 * acknowledged once and remembered. The flag is read before the camera ever
 * mounts; while it loads the gate shows nothing rather than a flash of felt.
 */

import { useCallback, useEffect, useState } from 'react';

import { getSettingsRepo } from '@/services/settings';

export const ETHICS_SETTING_KEY = 'liveplay.ethicsAcknowledged';

export type EthicsStatus = 'loading' | 'needed' | 'accepted';

export function useEthicsAcknowledgement(): { status: EthicsStatus; accept: () => void } {
  const [status, setStatus] = useState<EthicsStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    getSettingsRepo()
      .then((repo) => repo.get(ETHICS_SETTING_KEY))
      .then((value) => {
        if (!cancelled) {
          setStatus(value === 'true' ? 'accepted' : 'needed');
        }
      })
      .catch(() => {
        // A store that cannot be read must not dodge the gate: ask again.
        if (!cancelled) {
          setStatus('needed');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const accept = useCallback(() => {
    setStatus('accepted');

    getSettingsRepo()
      .then((repo) => repo.set(ETHICS_SETTING_KEY, 'true'))
      .catch(() => {
        // Persisting failed; the session continues and the gate returns next
        // launch, which errs on the side of showing the copy again.
      });
  }, []);

  return { status, accept };
}
