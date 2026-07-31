import { type PreferenceKey, type PreferencesRepo } from './repo';

/** A throwaway store that forgets everything on reload. For tests and previews. */
export function createMemoryPreferencesRepo(): PreferencesRepo {
  const values = new Map<PreferenceKey, string>();

  return {
    get: (key) => values.get(key) ?? null,
    set: (key, value) => void values.set(key, value),
  };
}
