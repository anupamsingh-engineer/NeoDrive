import mongoose from "mongoose";
import env from "./env.js";
import logger from "./logger.js";

// Indexes are managed explicitly via migrate-mongo in production; Mongoose autoIndex
// is convenient in dev but racy/slow to rely on for a production deploy.
mongoose.set("autoIndex", !env.isProduction);

mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
mongoose.connection.on("error", (err) => logger.error({ err }, "MongoDB connection error"));
mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));

export async function connectDB() {
  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await mongoose.connect(env.db.url);
      return;
    } catch (err) {
      attempt += 1;
      const backoffMs = Math.min(1000 * 2 ** attempt, 30000);
      logger.error({ err, attempt }, `MongoDB connect failed, retrying in ${backoffMs}ms`);
      if (attempt >= maxRetries) {
        logger.error("MongoDB connection exhausted retries, exiting");
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

export function isDBConnected() {
  return mongoose.connection.readyState === 1;
}
