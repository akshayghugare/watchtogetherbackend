require("dotenv").config();

console.log("Database configuration:");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_PORT:", process.env.DB_PORT);
console.log("DB_USER:", process.env.DB_USER);
console.log(" DB_PASSWORD:", process.env.DB_PASSWORD ? "****" : "(not set)");
console.log("DB_NAME:", process.env.DB_NAME);

// SSL: auto-enable for any remote host (e.g. Aiven cloud), keep off for
// local Postgres. DB_SSL in .env still overrides ("true"/"false") if set.
const dbHost = process.env.DB_HOST || "127.0.0.1";
const isLocalHost = ["localhost", "127.0.0.1", "::1", ""].includes(dbHost);
const useSSL =
  process.env.DB_SSL !== undefined && process.env.DB_SSL !== ""
    ? String(process.env.DB_SSL).toLowerCase() === "true"
    : !isLocalHost;

// Force the session onto the public schema so sequelize-cli can create
// SequelizeMeta / migration tables. Fixes Postgres 3F000
// "no schema has been selected to create in" (empty/invalid search_path).
const dialectOptions = {
  options: "-c search_path=public",
};

if (useSSL) {
  dialectOptions.ssl = {
    require: true,
    rejectUnauthorized: false,
  };
}

const common = {
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "test_db",
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 5432,
  dialect: "postgres",
  schema: "public",
  dialectOptions,
};

module.exports = {
  development: common,
  production: common,
};
