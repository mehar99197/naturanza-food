/**
 * Boots the Next.js app inside the Express process.
 *
 * Passenger starts backend/index.js and nothing else — the startup file is fixed
 * by Hostinger's deploy metadata and regenerated on every deploy — so Next runs
 * as a library here rather than as its own server on its own port.
 *
 * Two things matter for correctness:
 *
 *  1. The pool is handed over before Next prepares. Next's data layer adopts it
 *     (see src/server/db/pool.ts) instead of opening a second pool against a
 *     shared-hosting MySQL that has no spare connections.
 *  2. Preparation is awaited once and cached. Passenger can deliver concurrent
 *     requests to a cold worker, and `next().prepare()` must not run twice.
 */
const path = require("path");

const APP_ROOT = path.join(__dirname, "..");

/** Must match the key src/server/db/pool.ts reads. */
const POOL_KEY = Symbol.for("naturanza.db.pool");

let preparePromise = null;

/**
 * Prepares Next once and resolves to its request handler.
 *
 * @param {{ dbPool: import("mysql2/promise").Pool }} options
 * @returns {Promise<(req, res) => Promise<void>>}
 */
const getNextHandler = ({ dbPool }) => {
  if (preparePromise) {
    return preparePromise;
  }

  // Hand the pool over before require("next") so that any module Next evaluates
  // during prepare() already sees it.
  globalThis[POOL_KEY] = dbPool;

  preparePromise = (async () => {
    const next = require("next");
    const app = next({ dev: false, dir: APP_ROOT });
    await app.prepare();
    return app.getRequestHandler();
  })().catch((error) => {
    // Let the next request retry rather than caching a permanently rejected
    // promise — a transient failure during a cold start should not disable
    // rendering until the worker is recycled.
    preparePromise = null;
    throw error;
  });

  return preparePromise;
};

/**
 * Express middleware that serves the routes Next owns and passes on the rest.
 *
 * A render failure calls next(error) instead of throwing, so the existing
 * errorHandler answers it and one broken page cannot take the process down.
 *
 * @param {{ dbPool: import("mysql2/promise").Pool, isNextRoute: (pathname: string) => boolean }} options
 */
const createNextMiddleware = ({ dbPool, isNextRoute }) => async (req, res, next) => {
  if (!isNextRoute(req.path)) {
    return next();
  }

  try {
    const handle = await getNextHandler({ dbPool });
    return await handle(req, res);
  } catch (error) {
    return next(error);
  }
};

module.exports = { createNextMiddleware, getNextHandler, APP_ROOT };
