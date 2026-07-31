import Storage from 'expo-sqlite/kv-store';

import { SettingsError, type SettingsRepo } from './repo';

/**
 * Settings on the device, via expo-sqlite's key-value store. Loaded only
 * through `getSettingsRepo`'s dynamic import so Jest never sees the native
 * module — the same arrangement the hand-history repository uses.
 */
export function createKvSettingsRepo(): SettingsRepo {
  return {
    get: async (key) => {
      try {
        return await Storage.getItemAsync(key);
      } catch (error) {
        throw new SettingsError(`Could not read setting "${key}".`, error);
      }
    },
    set: async (key, value) => {
      try {
        await Storage.setItemAsync(key, value);
      } catch (error) {
        throw new SettingsError(`Could not write setting "${key}".`, error);
      }
    },
  };
}
