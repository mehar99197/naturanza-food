import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { dbPool } from "./pool";

/**
 * Thin typed wrappers over the pool.
 *
 * Every caller passes SQL with `?` placeholders and a separate params array —
 * the same rule the Express models follow. Nothing in this file interpolates a
 * value into a statement, and nothing that does should be added to it.
 *
 * The `server-only` import makes a stray import from a Client Component a build
 * error rather than a leaked database credential.
 */
export type QueryParams = ReadonlyArray<string | number | boolean | null | Date>;

/** Returns every matching row, or an empty array. */
export const queryRows = async <T>(sql: string, params: QueryParams = []): Promise<T[]> => {
  const [rows] = await dbPool.query<RowDataPacket[]>(sql, params as unknown[]);
  return rows as T[];
};

/** Returns the first matching row, or null when there is none. */
export const queryOne = async <T>(sql: string, params: QueryParams = []): Promise<T | null> => {
  const rows = await queryRows<T>(sql, params);
  return rows[0] ?? null;
};

/** Returns a single scalar aggregate (COUNT, SUM, MAX …), or null. */
export const queryScalar = async <T>(sql: string, params: QueryParams = []): Promise<T | null> => {
  const row = await queryOne<Record<string, T>>(sql, params);
  if (!row) return null;
  const [value] = Object.values(row);
  return value ?? null;
};
