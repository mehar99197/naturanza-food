const mysql = require("mysql2/promise");
require("dotenv").config();

const chatDatabase = process.env.CHAT_DB_NAME || "naturanza_chat";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: chatDatabase,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
});

const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log("Chat database connection established.");
  } catch (error) {
    console.error("Failed to connect to chat database:", error.message);
    process.exit(1);
  }
};

testConnection();

module.exports = pool;
