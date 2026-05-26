#!/usr/bin/env node

/**
 * Complete Database Setup & Seed Data Loader
 * Handles: database creation, schema setup, and optional seed data insertion.
 */

const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { ensureProductionSchema } = require("./utils/schemaCompatibility");

const config = {
    host: process.env.DB_HOST || "localhost",
    port: Number.parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : "",
    database: process.env.DB_NAME || "naturanza_food",
};

const shouldSeed = process.argv.includes("--with-seed") || process.argv.length <= 2;

const parseSqlStatements = (sqlText) => {
    const withoutLineComments = sqlText
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n");

    return withoutLineComments
        .split(";")
        .map((statement) => statement.trim())
        .filter(Boolean);
};

const runSqlFile = async (connection, filePath, options = {}) => {
    const sql = fs.readFileSync(filePath, "utf8");
    const statements = parseSqlStatements(sql);

    for (const statement of statements) {
        try {
            await connection.query(statement);
        } catch (error) {
            if (options.ignoreDuplicateErrors && ["ER_DUP_ENTRY", "ER_DUP_FIELDNAME"].includes(error.code)) {
                continue;
            }

            if (options.ignoreAlreadyExists && error.message.includes("already exists")) {
                continue;
            }

            throw error;
        }
    }
};

const logConfiguration = () => {
    console.log("===========================================================");
    console.log(" Naturanza Food Database Setup (MySQL 8)");
    console.log("===========================================================");
    console.log(`Host: ${config.host}`);
    console.log(`Port: ${config.port}`);
    console.log(`User: ${config.user}`);
    console.log(`Database: ${config.database}`);
    console.log(`Seed Data: ${shouldSeed ? "enabled" : "disabled"}`);
    console.log();
};

async function setupDatabase() {
    let connection;

    try {
        logConfiguration();

        console.log("1) Connecting to MySQL server...");
        connection = await mysql.createConnection({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            multipleStatements: false,
        });

        console.log("2) Ensuring database exists with utf8mb4...");
        await connection.query(
            `CREATE DATABASE IF NOT EXISTS \`${config.database}\`
             CHARACTER SET utf8mb4
             COLLATE utf8mb4_0900_ai_ci`,
        );

        await connection.changeUser({ database: config.database });

        console.log("3) Applying schema file...");
        await runSqlFile(connection, path.join(__dirname, "schema", "database.sql"), {
            ignoreDuplicateErrors: true,
            ignoreAlreadyExists: true,
        });

        console.log("4) Running compatibility checks...");
        await ensureProductionSchema(connection);

        if (shouldSeed) {
            const seedPath = path.join(__dirname, "seed-test-data.sql");
            if (fs.existsSync(seedPath)) {
                console.log("5) Loading seed data...");
                await runSqlFile(connection, seedPath, {
                    ignoreDuplicateErrors: true,
                });
            } else {
                console.log("5) Seed file (seed-test-data.sql) not found, skipping seed data.");
            }
        }

        console.log("6) Verifying record counts...");
        const [[categoryCount]] = await connection.query(
            "SELECT COUNT(*) AS count FROM categories",
        );
        const [[productCount]] = await connection.query(
            "SELECT COUNT(*) AS count FROM products",
        );
        const [[userCount]] = await connection.query("SELECT COUNT(*) AS count FROM users");

        console.log(`Categories: ${categoryCount.count}`);
        console.log(`Products: ${productCount.count}`);
        console.log(`Users: ${userCount.count}`);
        console.log();
        console.log("Database setup completed successfully.");
        console.log("Run `npm run dev` inside backend to start the API.");

        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error("Database setup failed:", error.message);

        if (error.code === "ER_ACCESS_DENIED_ERROR") {
            console.error("Hint: check DB_USER / DB_PASSWORD in backend/.env");
        }

        if (error.code === "ECONNREFUSED") {
            console.error("Hint: ensure official MySQL 8 server is running on localhost:3306");
        }

        if (connection) {
            await connection.end();
        }

        process.exit(1);
    }
}

setupDatabase();
