import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema';

export * from './schema';

type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __sql?: ReturnType<typeof postgres>;
  __db?: Db;
};

/**
 * Lazy singleton. Connecting on first query rather than on import means a
 * deployment without DATABASE_URL still builds and can render a setup notice
 * instead of crashing the whole app.
 */
export function db(): Db {
  if (globalForDb.__db) return globalForDb.__db;
  const url = env().DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = postgres(url, { max: 5, prepare: false });
  const instance = drizzle(sql, { schema });
  globalForDb.__sql = sql;
  globalForDb.__db = instance;
  return instance;
}

export function rawSql() {
  db();
  return globalForDb.__sql!;
}
