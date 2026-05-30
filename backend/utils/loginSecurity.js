const LOGIN_MAX_ATTEMPTS = Number.parseInt(process.env.LOGIN_MAX_ATTEMPTS || "5", 10) || 5;
const LOGIN_LOCK_MINUTES = Number.parseInt(process.env.LOGIN_LOCK_MINUTES || "15", 10) || 15;
const LOGIN_MAX_ATTEMPTS_ADMIN = Number.parseInt(process.env.LOGIN_MAX_ATTEMPTS_ADMIN || "5", 10) || 5;
const LOGIN_LOCK_MINUTES_ADMIN = Number.parseInt(process.env.LOGIN_LOCK_MINUTES_ADMIN || "30", 10) || 30;

const createLoginAttemptKey = (email, isAdmin = false) => {
  const prefix = isAdmin ? "admin_login_attempts" : "user_login_attempts";
  return `${prefix}:${String(email).trim().toLowerCase()}`;
};

const recordFailedLoginAtomic = async (dbConnection, userId, email, isAdmin = false) => {
  try {
    const lockMinutes = isAdmin ? LOGIN_LOCK_MINUTES_ADMIN : LOGIN_LOCK_MINUTES;
    const maxAttempts = isAdmin ? LOGIN_MAX_ATTEMPTS_ADMIN : LOGIN_MAX_ATTEMPTS;

    const [result] = await dbConnection.query(
      `UPDATE users
       SET failed_login_attempts = failed_login_attempts + 1,
           locked_until = CASE
             WHEN failed_login_attempts + 1 >= ?
             THEN DATE_ADD(NOW(), INTERVAL ? MINUTE)
             ELSE locked_until
           END
       WHERE id = ?`,
      [maxAttempts, lockMinutes, userId]
    );

    return result.affectedRows > 0;
  } catch (error) {
    return false;
  }
};

const resetLoginFailuresAtomic = async (dbConnection, userId) => {
  try {
    const [result] = await dbConnection.query(
      "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = ?",
      [userId]
    );
    return result.affectedRows > 0;
  } catch (error) {
    return false;
  }
};

const isAccountLockedAtomic = async (dbConnection, userRecord) => {
  try {
    const [rows] = await dbConnection.query(
      "SELECT locked_until FROM users WHERE id = ? FOR UPDATE",
      [userRecord.id]
    );

    if (!rows.length) {
      return false;
    }

    const lockUntil = rows[0].locked_until;
    if (!lockUntil) {
      return false;
    }

    const lockDate = new Date(lockUntil);
    return lockDate > new Date();
  } catch (error) {
    return false;
  }
};

const checkAccountLockout = async (dbConnection, userId) => {
  try {
    const [rows] = await dbConnection.query(
      `SELECT failed_login_attempts, locked_until
       FROM users
       WHERE id = ?
       FOR UPDATE`,
      [userId]
    );

    if (!rows.length) {
      return { locked: false, attemptsLeft: LOGIN_MAX_ATTEMPTS };
    }

    const { failed_login_attempts, locked_until } = rows[0];

    if (locked_until) {
      const lockDate = new Date(locked_until);
      if (lockDate > new Date()) {
        return {
          locked: true,
          lockUntil: locked_until,
          attemptsLeft: 0
        };
      }
    }

    return {
      locked: false,
      attemptsLeft: Math.max(0, LOGIN_MAX_ATTEMPTS - failed_login_attempts)
    };
  } catch (error) {
    return { locked: false, attemptsLeft: LOGIN_MAX_ATTEMPTS };
  }
};

const lockAccountAtomic = async (dbConnection, userId, minutes = LOGIN_LOCK_MINUTES) => {
  try {
    const [result] = await dbConnection.query(
      "UPDATE users SET locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?",
      [minutes, userId]
    );
    return result.affectedRows > 0;
  } catch (error) {
    return false;
  }
};

const unlockAccountAtomic = async (dbConnection, userId) => {
  try {
    const [result] = await dbConnection.query(
      "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?",
      [userId]
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
  unlockAccountAtomic,
  createLoginAttemptKey,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_LOCK_MINUTES,
  LOGIN_MAX_ATTEMPTS_ADMIN,
  LOGIN_LOCK_MINUTES_ADMIN,
};