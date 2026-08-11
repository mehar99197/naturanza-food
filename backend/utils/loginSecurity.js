const LOGIN_MAX_ATTEMPTS =
  Number.parseInt(process.env.LOGIN_MAX_ATTEMPTS || "5", 10) || 5;
const LOGIN_LOCK_MINUTES =
  Number.parseInt(process.env.LOGIN_LOCK_MINUTES || "15", 10) || 15;
const LOGIN_MAX_ATTEMPTS_ADMIN =
  Number.parseInt(process.env.LOGIN_MAX_ATTEMPTS_ADMIN || "5", 10) || 5;
const LOGIN_LOCK_MINUTES_ADMIN =
  Number.parseInt(process.env.LOGIN_LOCK_MINUTES_ADMIN || "30", 10) || 30;

// Progressive server-side delay for failed logins (capped at 30s).
const progressiveDelayMs = (failedAttempts) => {
  if (failedAttempts <= 0) return 0;
  return Math.min(failedAttempts * 1500, 30000);
};

const lockColumns = (isAdmin = false) => {
  if (isAdmin) {
    return {
      attemptsColumn: "admin_failed_login_attempts",
      lockColumn: "admin_locked_until",
      maxAttempts: LOGIN_MAX_ATTEMPTS_ADMIN,
      baseLockMinutes: LOGIN_LOCK_MINUTES_ADMIN,
    };
  }
  return {
    attemptsColumn: "user_failed_login_attempts",
    lockColumn: "user_locked_until",
    maxAttempts: LOGIN_MAX_ATTEMPTS,
    baseLockMinutes: LOGIN_LOCK_MINUTES,
  };
};

const isCurrentlyLocked = (lockedUntil) => {
  if (!lockedUntil) return false;
  const lockDate = new Date(lockedUntil);
  if (Number.isNaN(lockDate.getTime())) return false;
  return lockDate > new Date();
};

/**
 * Record a failed login attempt for a specific login context (user portal or
 * admin portal). Contexts have independent counters so a user-portal lockout
 * cannot lock the admin portal (and vice versa).
 *
 * Lockout uses exponential backoff: first lock = base minutes, second = 2x,
 * third = 4x, etc.
 */
const recordFailedLoginAtomic = async (
  dbConnection,
  userId,
  email,
  isAdmin = false,
) => {
  try {
    const { attemptsColumn, lockColumn, maxAttempts, baseLockMinutes } =
      lockColumns(isAdmin);

    const [rows] = await dbConnection.query(
      `SELECT ${attemptsColumn}, ${lockColumn}
       FROM users
       WHERE id = ?
       FOR UPDATE`,
      [userId],
    );

    if (!rows.length) {
      return { locked: false, attemptsLeft: maxAttempts };
    }

    let attempts = Number(rows[0][attemptsColumn] || 0);
    const existingLock = rows[0][lockColumn];

    // If already locked, keep the lock in place and do not reset the counter.
    if (isCurrentlyLocked(existingLock)) {
      return { locked: true, lockUntil: existingLock, attemptsLeft: 0 };
    }

    attempts += 1;
    const overflow = Math.max(0, attempts - maxAttempts);
    const shouldLock = attempts >= maxAttempts;

    let lockUntil = null;
    if (shouldLock) {
      const multiplier = Math.max(1, 2 ** (overflow - 1));
      const lockMinutes = baseLockMinutes * multiplier;
      lockUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
    }

    await dbConnection.query(
      `UPDATE users
       SET ${attemptsColumn} = ?,
           ${lockColumn} = ?
       WHERE id = ?`,
      [attempts, lockUntil, userId],
    );

    return {
      locked: shouldLock,
      lockUntil: lockUntil || undefined,
      attemptsLeft: Math.max(0, maxAttempts - attempts),
    };
  } catch (error) {
    return { locked: false, attemptsLeft: LOGIN_MAX_ATTEMPTS };
  }
};

/**
 * Reset both user and admin login counters on a successful login. This keeps
 * the UX predictable: a legitimate login clears any stale failure state.
 */
const resetLoginFailuresAtomic = async (dbConnection, userId) => {
  try {
    const [result] = await dbConnection.query(
      `UPDATE users
       SET user_failed_login_attempts = 0,
           user_locked_until = NULL,
           admin_failed_login_attempts = 0,
           admin_locked_until = NULL
       WHERE id = ?`,
      [userId],
    );
    return result.affectedRows > 0;
  } catch (error) {
    return false;
  }
};

const checkAccountLockout = async (
  dbConnection,
  userId,
  isAdmin = false,
) => {
  try {
    const { attemptsColumn, lockColumn, maxAttempts } = lockColumns(isAdmin);

    const [rows] = await dbConnection.query(
      `SELECT ${attemptsColumn}, ${lockColumn}
       FROM users
       WHERE id = ?
       FOR UPDATE`,
      [userId],
    );

    if (!rows.length) {
      return { locked: false, attemptsLeft: maxAttempts };
    }

    const attempts = Number(rows[0][attemptsColumn] || 0);
    const lockedUntil = rows[0][lockColumn];

    if (isCurrentlyLocked(lockedUntil)) {
      return {
        locked: true,
        lockUntil: lockedUntil,
        attemptsLeft: 0,
      };
    }

    // Lock has expired; clear it so the counter reflects reality.
    if (lockedUntil && !isCurrentlyLocked(lockedUntil)) {
      await dbConnection.query(
        `UPDATE users SET ${attemptsColumn} = 0, ${lockColumn} = NULL WHERE id = ?`,
        [userId],
      );
      return { locked: false, attemptsLeft: maxAttempts };
    }

    return {
      locked: false,
      attemptsLeft: Math.max(0, maxAttempts - attempts),
    };
  } catch (error) {
    return { locked: false, attemptsLeft: LOGIN_MAX_ATTEMPTS };
  }
};

const isAccountLockedAtomic = async (
  dbConnection,
  userRecord,
  isAdmin = false,
) => {
  if (!userRecord?.id) return false;
  const status = await checkAccountLockout(dbConnection, userRecord.id, isAdmin);
  return status.locked;
};

const lockAccountAtomic = async (
  dbConnection,
  userId,
  minutes = LOGIN_LOCK_MINUTES,
  isAdmin = false,
) => {
  try {
    const { lockColumn } = lockColumns(isAdmin);
    const [result] = await dbConnection.query(
      `UPDATE users SET ${lockColumn} = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?`,
      [minutes, userId],
    );
    return result.affectedRows > 0;
  } catch (error) {
    return false;
  }
};

const unlockAccountAtomic = async (dbConnection, userId) => {
  try {
    const [result] = await dbConnection.query(
      `UPDATE users
       SET user_failed_login_attempts = 0,
           user_locked_until = NULL,
           admin_failed_login_attempts = 0,
           admin_locked_until = NULL
       WHERE id = ?`,
      [userId],
    );
    return result.affectedRows > 0;
  } catch (error) {
    return false;
  }
};

module.exports = {
  recordFailedLoginAtomic,
  resetLoginFailuresAtomic,
  isAccountLockedAtomic,
  checkAccountLockout,
  lockAccountAtomic,
  progressiveDelayMs,
  unlockAccountAtomic,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_LOCK_MINUTES,
  LOGIN_MAX_ATTEMPTS_ADMIN,
  LOGIN_LOCK_MINUTES_ADMIN,
};
