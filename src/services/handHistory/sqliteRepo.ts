/**
 * The repository on expo-sqlite — the only file that imports it.
 *
 * Deliberately dumb: one statement per method, JSON at the edges, every
 * failure rethrown as a `PersistenceError`. Behavior is specified by the
 * contract suite, which runs against `memoryRepo`; this implementation is
 * exercised in the running app, where the native module exists.
 */

import * as SQLite from 'expo-sqlite';

import { type Blinds, type DecisionReview, type HandEvent } from '@/engine';

import { COACH_VERSION, pendingMigrations } from './migrations';
import {
  PersistenceError,
  type HandHistoryRepo,
  type PersistenceOp,
  type StoredHandSummary,
} from './repo';

const DATABASE_NAME = 'pokerpal.db';

interface HandSummaryRow {
  id: number;
  session_id: number;
  hand_number: number;
  played_at: number;
  hero_net: number;
  decisions_graded: number;
  ev_lost: number;
}

interface HandRow extends HandSummaryRow {
  seed: number;
  button: number;
  small_blind: number;
  big_blind: number;
  ante: number | null;
  seats_json: string;
  events_json: string;
}

/** Opens (and migrates) the on-device database and returns the repository. */
export async function openSqliteHandHistoryRepo(): Promise<HandHistoryRepo> {
  const db = await guard('open', () => SQLite.openDatabaseAsync(DATABASE_NAME));

  await guard('migrate', () => migrate(db));

  return {
    createSession: (session) =>
      guard('write', async () => {
        const result = await db.runAsync(
          `INSERT INTO sessions (started_at, style, seed, hero_seat, small_blind, big_blind, ante)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          session.startedAt,
          session.style,
          session.seed,
          session.heroSeat,
          session.blinds.smallBlind,
          session.blinds.bigBlind,
          session.blinds.ante ?? null,
        );

        return result.lastInsertRowId;
      }),

    saveHand: (hand) =>
      guard('write', () =>
        db.withTransactionAsync(async () => {
          const inserted = await db.runAsync(
            `INSERT OR IGNORE INTO hands
               (session_id, hand_number, played_at, seed, button,
                small_blind, big_blind, ante, seats_json, events_json, hero_net)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            hand.sessionId,
            hand.handNumber,
            hand.playedAt,
            hand.seed,
            hand.button,
            hand.blinds.smallBlind,
            hand.blinds.bigBlind,
            hand.blinds.ante ?? null,
            JSON.stringify(hand.seats),
            JSON.stringify(hand.events),
            hand.heroNet,
          );

          // Zero changes means the UNIQUE(session_id, hand_number) row already
          // exists: the defensive double-save, which must stay a no-op.
          if (inserted.changes === 0) {
            return;
          }

          for (const [ordinal, review] of hand.reviews.entries()) {
            await db.runAsync(
              `INSERT INTO decision_reviews
                 (hand_id, ordinal, street, grade, leak, ev_loss, coach_version, review_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              inserted.lastInsertRowId,
              ordinal,
              review.facts.street,
              review.grade,
              review.leak,
              review.evLoss,
              COACH_VERSION,
              JSON.stringify(review),
            );
          }
        }),
      ),

    listHands: (options) =>
      guard('read', async () => {
        const rows = await db.getAllAsync<HandSummaryRow>(
          `SELECT h.id, h.session_id, h.hand_number, h.played_at, h.hero_net,
                  COUNT(r.id) AS decisions_graded,
                  COALESCE(SUM(r.ev_loss), 0) AS ev_lost
           FROM hands h
           LEFT JOIN decision_reviews r ON r.hand_id = h.id
           GROUP BY h.id
           ORDER BY h.played_at DESC, h.id DESC
           LIMIT ?`,
          options?.limit ?? -1,
        );

        return rows.map(toSummary);
      }),

    getHand: (id) =>
      guard('read', async () => {
        const row = await db.getFirstAsync<HandRow>(
          `SELECT h.*,
                  (SELECT COUNT(*) FROM decision_reviews r WHERE r.hand_id = h.id) AS decisions_graded,
                  (SELECT COALESCE(SUM(r.ev_loss), 0) FROM decision_reviews r WHERE r.hand_id = h.id) AS ev_lost
           FROM hands h WHERE h.id = ?`,
          id,
        );

        if (!row) {
          return null;
        }

        const reviewRows = await db.getAllAsync<{ review_json: string }>(
          `SELECT review_json FROM decision_reviews WHERE hand_id = ? ORDER BY ordinal`,
          id,
        );

        const blinds: Blinds = {
          smallBlind: row.small_blind,
          bigBlind: row.big_blind,
          ...(row.ante === null ? {} : { ante: row.ante }),
        };

        return {
          ...toSummary(row),
          seed: row.seed,
          button: row.button,
          blinds,
          // The JSON came out of these exact types on the way in; validating
          // the whole event union at runtime is not this slice.
          seats: JSON.parse(row.seats_json) as { id: string; stack: number }[],
          events: JSON.parse(row.events_json) as HandEvent[],
          reviews: reviewRows.map((stored) => JSON.parse(stored.review_json) as DecisionReview),
        };
      }),

    totals: () =>
      guard('read', async () => {
        const row = await db.getFirstAsync<{ hands: number; net: number; graded: number }>(
          `SELECT COUNT(*) AS hands,
                  COALESCE(SUM(hero_net), 0) AS net,
                  (SELECT COUNT(*) FROM decision_reviews) AS graded
           FROM hands`,
        );

        return {
          hands: row?.hands ?? 0,
          net: row?.net ?? 0,
          decisionsGraded: row?.graded ?? 0,
        };
      }),
  };
}

/** Applies whatever schema batches this database has not seen, in order. */
async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  for (const batch of pendingMigrations(version)) {
    await db.withTransactionAsync(async () => {
      for (const statement of batch) {
        await db.execAsync(statement);
      }
    });
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}

function toSummary(row: HandSummaryRow): StoredHandSummary {
  return {
    id: row.id,
    sessionId: row.session_id,
    handNumber: row.hand_number,
    playedAt: row.played_at,
    heroNet: row.hero_net,
    decisionsGraded: row.decisions_graded,
    evLost: row.ev_lost,
  };
}

async function guard<T>(op: PersistenceOp, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (cause) {
    throw new PersistenceError(op, `Hand history ${op} failed.`, { cause });
  }
}
