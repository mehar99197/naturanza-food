/**
 * Idempotent pool-connection release.
 *
 * Some handlers release their connection early — before slow, non-DB work such
 * as session issuance or outbound email — and still need a `finally` guard so an
 * unexpected throw can never strand the connection in the pool's in-use set.
 * mysql2's `release()` is NOT idempotent: calling it twice pushes the same
 * connection onto the free list twice, so two callers can end up sharing one
 * connection. This wrapper makes the double call a no-op.
 *
 * Usage:
 *   const connection = await db.promise().getConnection();
 *   const release = createConnectionReleaser(connection);
 *   try { ... release(); ...slow work... } finally { release(); }
 */
const createConnectionReleaser = (connection) => {
  let released = false;

  return () => {
    if (released || !connection) {
      return;
    }
    released = true;
    connection.release();
  };
};

module.exports = { createConnectionReleaser };
