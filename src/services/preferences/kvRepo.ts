import Storage from 'expo-sqlite/kv-store';

import { type PreferenceKey, type PreferencesRepo } from './repo';

/** Namespaced, so a preference can never collide with anything else on the device. */
const PREFIX = 'pokerpal.pref.';

/**
 * Preferences on `expo-sqlite`'s key-value store.
 *
 * Its own SQLite database rather than a table inside `pokerpal.db`: a UI setting
 * has nothing to do with hand history, and hanging it off that schema would mean
 * a migration every time a screen gains a switch. The store ships with the SDK,
 * so this costs no new dependency.
 *
 * A failed read or write is swallowed to a default. Losing a preference is a
 * minor annoyance; a screen that will not render because a setting could not be
 * loaded is a broken app.
 */
export function createKvPreferencesRepo(): PreferencesRepo {
  return {
    get(key: PreferenceKey) {
      try {
        return Storage.getItemSync(PREFIX + key);
      } catch {
        return null;
      }
    },

    set(key: PreferenceKey, value: string) {
      try {
        Storage.setItemSync(PREFIX + key, value);
      } catch {
        // Nothing to tell the player: the setting still applies to this session,
        // it just will not survive a relaunch.
      }
    },
  };
}
