import "dotenv/config";

export default {
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
