import { MIGRATIONS, pendingMigrations, SCHEMA_VERSION } from './migrations';

describe('migrations', () => {
  it('is versioned by its length', () => {
    expect(SCHEMA_VERSION).toBe(MIGRATIONS.length);
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('gives a fresh database every batch', () => {
    expect(pendingMigrations(0)).toEqual(MIGRATIONS);
  });

  it('gives a current database nothing', () => {
    expect(pendingMigrations(SCHEMA_VERSION)).toEqual([]);
  });

  it('gives a halfway database only what it is missing', () => {
    expect(pendingMigrations(1)).toEqual(MIGRATIONS.slice(1));
  });

  it('treats a nonsense negative version as fresh', () => {
    expect(pendingMigrations(-3)).toEqual(MIGRATIONS);
  });
});
