const mysql = require("mysql2/promise");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const toNumber = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: toNumber(process.env.DB_PORT, 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : "",
  database: process.env.DB_NAME || "naturanza_food",
  waitForConnections: true,
  connectionLimit: toNumber(process.env.DB_CONNECTION_LIMIT, 10),
  queueLimit: 0,
  charset: "utf8mb4",
};

const dbPool = mysql.createPool(dbConfig);

const testDatabaseConnection = async () => {
  const connection = await dbPool.getConnection();

  try {
    const [rows] = await connection.query(
      "SELECT DATABASE() AS databaseName, VERSION() AS mysqlVersion",
    );

    return rows[0];
  } finally {
    connection.release();
  }
};

const withTransaction = async (workFn) => {
  const connection = await dbPool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await workFn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const db = {
  query(sql, params, callback) {
    const hasParams = Array.isArray(params) || params === null;
    const normalizedParams = hasParams ? params || [] : [];
    const normalizedCallback = typeof params === "function" ? params : callback;

    const operation = dbPool
      .query(sql, normalizedParams)
      .then(([rows, fields]) => {
        if (typeof normalizedCallback === "function") {
          normalizedCallback(null, rows, fields);
          return undefined;
        }

        return [rows, fields];
      })
      .catch((error) => {
        if (typeof normalizedCallback === "function") {
          normalizedCallback(error);
          return undefined;
        }

        throw error;
      });

    if (typeof normalizedCallback === "function") {
      return undefined;
    }

    return operation;
  },

  promise() {
    return dbPool;
  },
};

module.exports = {
  db,
  dbPool,
  dbConfig,
  testDatabaseConnection,
  withTransaction,
};
