import { type SettingsRepo } from './repo';

/** The test seam: settings that live exactly as long as the process. */
export function createMemorySettingsRepo(): SettingsRepo {
  const values = new Map<string, string>();

  return {
    get: (key) => Promise.resolve(values.get(key) ?? null),
    set: (key, value) => {
      values.set(key, value);

      return Promise.resolve();
    },
  };
}
