/**
 * The settings service's front door, shaped like the hand-history one: a lazy
 * singleton over the device store, a swappable seam for tests.
 */

import { createMemorySettingsRepo } from './memoryRepo';
import { type SettingsRepo } from './repo';

export { createMemorySettingsRepo } from './memoryRepo';
export { SettingsError, type SettingsRepo } from './repo';

let repoPromise: Promise<SettingsRepo> | null = null;

/** The app-wide settings store, opened on first use. */
export function getSettingsRepo(): Promise<SettingsRepo> {
  repoPromise ??= import('./kvRepo').then((module) => module.createKvSettingsRepo());

  return repoPromise;
}

/** Test seam: replace the store. Pass null to restore the real one. */
export function setSettingsRepo(repo: SettingsRepo | null): void {
  repoPromise = repo ? Promise.resolve(repo) : null;
}

/** A fresh throwaway store, for tests and previews. */
export function installMemorySettingsRepo(): SettingsRepo {
  const repo = createMemorySettingsRepo();

  setSettingsRepo(repo);

  return repo;
}
