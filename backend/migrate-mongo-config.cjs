require("dotenv/config");
require("./src/config/dns.cjs");

module.exports = {
  mongodb: {
    url: process.env.DB_URL,
    options: {},
  },
  migrationsDir: "migrations",
  changelogCollectionName: "migrations_changelog",
  migrationFileExtension: ".js",
  useFileHash: false,
  moduleSystem: "esm",
};
