/**
 * The schema, one version at a time.
 *
 * Entries are append-only: a shipped entry is history and editing it would
 * strand every installed database at a version that no longer means anything.
 * A schema change is a new entry, applied by `migrate` in `sqliteRepo`.
 */

/** Statements per schema version; index 0 takes a database to version 1. */
export const MIGRATIONS: readonly (readonly string[])[] = [
  [
    `CREATE TABLE sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at  INTEGER NOT NULL,
      style       TEXT    NOT NULL,
      seed        INTEGER NOT NULL,
      hero_seat   INTEGER NOT NULL,
      small_blind INTEGER NOT NULL,
      big_blind   INTEGER NOT NULL,
      ante        INTEGER
    )`,
    `CREATE TABLE hands (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      hand_number INTEGER NOT NULL,
      played_at   INTEGER NOT NULL,
      seed        INTEGER NOT NULL,
      button      INTEGER NOT NULL,
      small_blind INTEGER NOT NULL,
      big_blind   INTEGER NOT NULL,
      ante        INTEGER,
      seats_json  TEXT    NOT NULL,
      events_json TEXT    NOT NULL,
      hero_net    INTEGER NOT NULL,
      UNIQUE (session_id, hand_number)
    )`,
    `CREATE INDEX idx_hands_played_at ON hands (played_at)`,
    `CREATE TABLE decision_reviews (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      hand_id       INTEGER NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
      ordinal       INTEGER NOT NULL,
      street        TEXT    NOT NULL,
      grade         TEXT    NOT NULL,
      leak          TEXT,
      ev_loss       REAL    NOT NULL,
      coach_version INTEGER NOT NULL,
      review_json   TEXT    NOT NULL,
      UNIQUE (hand_id, ordinal)
    )`,
  ],
  // Version 2: where a session's hands came from — the practice table
  // ('game') or LivePlay's camera ('live').
  [`ALTER TABLE sessions ADD COLUMN origin TEXT NOT NULL DEFAULT 'game'`],
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/**
 * A stored grade's provenance. Bump when `coach.ts`'s rubric changes meaning,
 * so stale verdicts can be found and re-graded from their stored events.
 */
export const COACH_VERSION = 1;

/** The batches a database at `userVersion` still has to apply, in order. */
export function pendingMigrations(userVersion: number): readonly (readonly string[])[] {
  return MIGRATIONS.slice(Math.max(0, userVersion));
}
