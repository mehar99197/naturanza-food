const {
  dbPool,
  db,
  withTransaction,
  testDatabaseConnection,
} = require("../../config/db");

const pool = dbPool;

module.exports = {
  pool,
  db,
  withTransaction,
  testDatabaseConnection,
};
