
import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";

const required = [
  "DB_HOST",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD"
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing environment variable: ${key}`);
    process.exit(1);
  }
}

let connection;

try {
  connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: false
  });

  const schema = await readFile(
    new URL("../database/schema.sql", import.meta.url),
    "utf8"
  );

  const statements = schema
    .split(";")
    .map(statement => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await connection.query(statement);
  }

  console.log("Database migration completed successfully.");
} catch (error) {
  console.error("Database migration failed:", error.message);
  process.exitCode = 1;
} finally {
  if (connection) {
    await connection.end();
  }
}
