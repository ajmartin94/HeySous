import { config } from "./config.js";
import { createDatabase } from "./db/index.js";

// Initialize database
const db = createDatabase(config.dbFileName);

console.log("HeySous starting...");
console.log(`  Mode: ${config.botMode}`);
console.log(`  Database: ${config.dbFileName}`);
console.log(`  Environment: ${config.isDev ? "development" : "production"}`);
