const { dbPool } = require("../config/db");

const createInquiry = async ({ name, email, phone, subject, message }) => {
  const [result] = await dbPool.query(
    `INSERT INTO contacts (name, email, phone, subject, message)
     VALUES (?, ?, ?, ?, ?)`,
    [name, email, phone || null, subject || null, message],
  );

  return result.insertId;
};

const listInquiries = async () => {
  const [rows] = await dbPool.query(
    "SELECT * FROM contacts ORDER BY created_at DESC",
  );

  return rows;
};

module.exports = {
  createInquiry,
  listInquiries,
};
