const getAdminRecipients = async (connection, excludeUserId = null) => {
  let query = "SELECT id, email, name FROM users WHERE role = 'admin' AND is_active = TRUE";
  const params = [];

  if (Number.isInteger(excludeUserId)) {
    query += " AND id <> ?";
    params.push(excludeUserId);
  }

  const [rows] = await connection.query(query, params);
  return rows || [];
};

const insertAdminNotifications = async (
  connection,
  { type, title, message, payload = null, excludeUserId = null },
) => {
  const adminRows = await getAdminRecipients(connection, excludeUserId);

  if (!adminRows.length) {
    return [];
  }

  const values = adminRows.map((adminRow) => [
    adminRow.id,
    type,
    title,
    message,
    payload ? JSON.stringify(payload) : null,
  ]);

  await connection.query(
    `INSERT INTO notifications (user_id, type, title, message, payload)
     VALUES ?`,
    [values],
  );

  return adminRows;
};

module.exports = {
  getAdminRecipients,
  insertAdminNotifications,
};
