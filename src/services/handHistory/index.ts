/**
 * The hand-history service's front door.
 *
 * The SQLite implementation is loaded lazily via a dynamic import, so nothing
 * that merely imports this module — the practice store does, at app start —
 * touches the native module, and Jest never has expo-sqlite in its module
 * graph at all: `jest.setup.ts` installs the in-memory repository instead.
 */

import { createMemoryHandHistoryRepo } from './memoryRepo';
import { type HandHistoryRepo } from './repo';

export { HandArchiver, type ArchivedHand, type SessionMeta } from './archiver';
export { createMemoryHandHistoryRepo } from './memoryRepo';
export {
  PersistenceError,
  type HandHistoryRepo,
  type HandHistoryTotals,
  type NewHandRecord,
  type NewSessionRecord,
  type SessionId,
  type StoredHand,
  type StoredHandSummary,
  type StoredSessionStat,
} from './repo';

let repoPromise: Promise<HandHistoryRepo> | null = null;

/** The app-wide repository, opened (and migrated) on first use. */
export function getHandHistoryRepo(): Promise<HandHistoryRepo> {
  repoPromise ??= import('./sqliteRepo').then((module) => module.openSqliteHandHistoryRepo());

  return repoPromise;
}

/** Test seam: replace the repository. Pass null to restore the real one. */
export function setHandHistoryRepo(repo: HandHistoryRepo | null): void {
  repoPromise = repo ? Promise.resolve(repo) : null;
}

/** A fresh throwaway repository, for tests and previews. */
export function installMemoryHandHistoryRepo(): HandHistoryRepo {
  const repo = createMemoryHandHistoryRepo();

  setHandHistoryRepo(repo);

  return repo;
}
