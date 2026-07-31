/**
 * The preferences service's front door.
 *
 * Same shape as `services/handHistory`: the native implementation is behind a
 * seam so Jest never has `expo-sqlite` in its module graph — `jest.setup.ts`
 * installs the in-memory store instead.
 *
 * Unlike hand history this resolves synchronously. A setting that decides which
 * words a screen renders has to be known on the first paint, or the player
 * watches the app change its mind.
 */

import { createMemoryPreferencesRepo } from './memoryRepo';
import { type PreferencesRepo } from './repo';

export { createMemoryPreferencesRepo } from './memoryRepo';
export { type PreferenceKey, type PreferencesRepo } from './repo';

interface KvModule {
  createKvPreferencesRepo(): PreferencesRepo;
}

let repo: PreferencesRepo | null = null;

/**
 * The app-wide store, opened on first use.
 *
 * Falls back to memory if the native module cannot be loaded at all — under
 * Jest, and on any platform where it is missing. A setting that will not
 * survive a relaunch is a small loss; a screen that will not render because a
 * preference could not be read is a broken app.
 */
export function getPreferencesRepo(): PreferencesRepo {
  if (!repo) {
    try {
      // Required lazily so the native module is only touched by a caller that
      // actually reads a preference.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      repo = (require('./kvRepo') as KvModule).createKvPreferencesRepo();
    } catch {
      repo = createMemoryPreferencesRepo();
    }
  }

  return repo;
}

/** Test seam: replace the store. Pass null to restore the real one. */
export function setPreferencesRepo(next: PreferencesRepo | null): void {
  repo = next;
}

/** A fresh throwaway store, for tests and previews. */
export function installMemoryPreferencesRepo(): PreferencesRepo {
  const memory = createMemoryPreferencesRepo();

  setPreferencesRepo(memory);

  return memory;
}
