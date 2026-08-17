import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";

/**
 * One mysql2 pool for the whole process.
 *
 * In production Next.js runs inside the Express app, and Express has already
 * built a pool in backend/config/db.js by the time any page renders. Creating a
 * second one here would double the connection count against a shared-hosting
 * MySQL that does not have connections to spare, and the two pools would hold
 * independent transactions — so the composition root hands its pool over on the
 * global below and this module adopts it.
 *
 * The fallback branch exists for `next dev` run on its own, where there is no
 * Express host. Reusing the global there also survives HMR, which would
 * otherwise leak a pool per recompile.
 */
const POOL_KEY = Symbol.for("naturanza.db.pool");

type PoolCarrier = { [POOL_KEY]?: Pool };

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const createPool = (): Pool =>
  mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME || "naturanza_food",
    waitForConnections: true,
    connectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 10),
    queueLimit: 0,
    charset: "utf8mb4",
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  });

const carrier = globalThis as PoolCarrier;

export const dbPool: Pool = carrier[POOL_KEY] ?? createPool();

carrier[POOL_KEY] = dbPool;

/**
 * Called by the Express composition root before Next boots, so page renders and
 * API routes share a single pool. Safe to call more than once with the same pool.
 */
export const adoptPool = (pool: Pool): void => {
  carrier[POOL_KEY] = pool;
};
