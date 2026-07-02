import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

// SSL: auto-enable for any remote host (e.g. Aiven cloud), keep off for
// local Postgres. DB_SSL in .env still overrides ("true"/"false") if set.
const dbHost = process.env.DB_HOST || "localhost";
const isLocalHost = ["localhost", "127.0.0.1", "::1", ""].includes(dbHost);
const useSSL =
  process.env.DB_SSL !== undefined && process.env.DB_SSL !== ""
    ? String(process.env.DB_SSL).toLowerCase() === "true"
    : !isLocalHost;

// Force session onto the public schema (matches config.js used by
// sequelize-cli). Prevents Postgres 3F000 "no schema has been selected".
const dialectOptions: Record<string, unknown> = {
  options: "-c search_path=public",
};

if (useSSL) {
  dialectOptions.ssl = {
    require: true,
    rejectUnauthorized: false,
  };
}

const sequelize = new Sequelize({
  dialect: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "mydbtestingone",
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  dialectOptions,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    underscored: true,       // snake_case column names
    timestamps: true,        // auto created_at / updated_at
    freezeTableName: false,  // auto pluralize table names
  },
});

export default sequelize;
