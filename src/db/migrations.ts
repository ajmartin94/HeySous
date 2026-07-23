import type BetterSqlite3 from "better-sqlite3";
import { logger } from "../logger.js";
import { parseRecipeTotalMinutes, parseTimeToMinutes } from "../reminders/generator.js";

export interface Migration {
  version: number;
  name: string;
  up: (sqlite: BetterSqlite3.Database) => void;
}

// Add new migrations here. Versions must be sequential integers starting at 1.
export const migrations: Migration[] = [
  {
    version: 1,
    name: "add-source-url-to-knowledge-items",
    up: (sqlite) => {
      // On fresh install, knowledge_items doesn't exist yet (created later by initializeFts).
      // Skip — initializeFts CREATE TABLE now includes source_url.
      const tableExists = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_items'")
        .get();
      if (!tableExists) return;

      // Existing database: add column if missing
      const columns = sqlite.pragma("table_info(knowledge_items)") as Array<{ name: string }>;
      const hasSourceUrl = columns.some((c) => c.name === "source_url");
      if (!hasSourceUrl) {
        sqlite.exec("ALTER TABLE knowledge_items ADD COLUMN source_url TEXT");
      }
    },
  },
  {
    version: 2,
    name: "create-notifications-tables",
    up: (sqlite) => {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version TEXT NOT NULL UNIQUE,
          content TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `);
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS notification_deliveries (
          notification_id INTEGER NOT NULL REFERENCES notifications(id),
          household_id TEXT NOT NULL,
          delivered_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (notification_id, household_id)
        )
      `);
    },
  },
  {
    version: 3,
    name: "notification-deliveries-per-user",
    up: (sqlite) => {
      sqlite.exec(`
        CREATE TABLE notification_deliveries_new (
          notification_id INTEGER NOT NULL REFERENCES notifications(id),
          user_id TEXT NOT NULL,
          delivered_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (notification_id, user_id)
        )
      `);
      // On a fresh install, runMigrations() runs before initializeUsers()
      // (see src/db/index.ts), so the users table doesn't exist yet. There's
      // nothing to backfill in that case -- a brand-new database has no
      // notification_deliveries rows either -- so skip the join entirely
      // rather than fail. Existing databases (which already have a users
      // table) are unaffected and still get the backfill.
      const usersTableExists = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        .get();
      if (usersTableExists) {
        // Migrate: mark all users in already-delivered households as delivered
        sqlite.exec(`
          INSERT INTO notification_deliveries_new (notification_id, user_id, delivered_at)
          SELECT nd.notification_id, u.telegram_id, nd.delivered_at
          FROM notification_deliveries nd
          JOIN users u ON u.household_id = nd.household_id
        `);
      }
      sqlite.exec("DROP TABLE notification_deliveries");
      sqlite.exec(
        "ALTER TABLE notification_deliveries_new RENAME TO notification_deliveries",
      );
    },
  },
  {
    version: 4,
    name: "clear-inherited-notification-deliveries",
    up: (sqlite) => {
      // Migration 3 incorrectly marked all household members as "delivered"
      // even though only one member actually saw each notification.
      // Clear all records so every user gets a fresh delivery.
      sqlite.exec("DELETE FROM notification_deliveries");
    },
  },
  {
    version: 5,
    name: "add-version-columns-for-optimistic-locking",
    up: (sqlite) => {
      // knowledge_items: add version + updated_by columns for optimistic locking
      const kiExists = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_items'")
        .get();
      if (kiExists) {
        const kiCols = sqlite.pragma("table_info(knowledge_items)") as Array<{ name: string }>;
        if (!kiCols.some((c) => c.name === "version")) {
          sqlite.exec("ALTER TABLE knowledge_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1");
        }
        if (!kiCols.some((c) => c.name === "updated_by")) {
          sqlite.exec("ALTER TABLE knowledge_items ADD COLUMN updated_by TEXT");
        }
      }

      // meal_plans: add version + updated_by columns
      const mpExists = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='meal_plans'")
        .get();
      if (mpExists) {
        const mpCols = sqlite.pragma("table_info(meal_plans)") as Array<{ name: string }>;
        if (!mpCols.some((c) => c.name === "version")) {
          sqlite.exec("ALTER TABLE meal_plans ADD COLUMN version INTEGER NOT NULL DEFAULT 1");
        }
        if (!mpCols.some((c) => c.name === "updated_by")) {
          sqlite.exec("ALTER TABLE meal_plans ADD COLUMN updated_by TEXT");
        }
      }

      // grocery_lists: add version + updated_by columns
      const glExists = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='grocery_lists'")
        .get();
      if (glExists) {
        const glCols = sqlite.pragma("table_info(grocery_lists)") as Array<{ name: string }>;
        if (!glCols.some((c) => c.name === "version")) {
          sqlite.exec("ALTER TABLE grocery_lists ADD COLUMN version INTEGER NOT NULL DEFAULT 1");
        }
        if (!glCols.some((c) => c.name === "updated_by")) {
          sqlite.exec("ALTER TABLE grocery_lists ADD COLUMN updated_by TEXT");
        }
      }
    },
  },
  {
    version: 6,
    name: "add-recipe-time-columns",
    up: (sqlite) => {
      // On fresh install, knowledge_items may not exist yet (created later by initializeFts).
      const tableExists = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_items'")
        .get();
      if (!tableExists) return;

      // Add each column individually (idempotent, safe to re-run)
      const columns = sqlite.pragma("table_info(knowledge_items)") as Array<{ name: string }>;
      if (!columns.some((c) => c.name === "prep_time_minutes")) {
        sqlite.exec("ALTER TABLE knowledge_items ADD COLUMN prep_time_minutes INTEGER");
      }
      if (!columns.some((c) => c.name === "cook_time_minutes")) {
        sqlite.exec("ALTER TABLE knowledge_items ADD COLUMN cook_time_minutes INTEGER");
      }
      if (!columns.some((c) => c.name === "total_time_minutes")) {
        sqlite.exec("ALTER TABLE knowledge_items ADD COLUMN total_time_minutes INTEGER");
      }

      // Backfill: parse time data from existing recipe content
      const recipes = sqlite
        .prepare(
          `SELECT ki.id, ki.content FROM knowledge_items ki
           JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id
           WHERE kt.tag = 'recipe'`
        )
        .all() as Array<{ id: number; content: string }>;

      const updateStmt = sqlite.prepare(
        `UPDATE knowledge_items
         SET prep_time_minutes = ?, cook_time_minutes = ?, total_time_minutes = ?
         WHERE id = ?`
      );

      for (const row of recipes) {
        let prepMinutes: number | null = null;
        let cookMinutes: number | null = null;
        let totalMinutes: number | null = null;

        // Parse individual time lines
        const lines = row.content.split("\n");
        for (const line of lines) {
          const prepMatch = line.match(/^Prep\s*Time:\s*(.+)$/i);
          if (prepMatch) {
            prepMinutes = parseTimeToMinutes(prepMatch[1]);
          }
          const cookMatch = line.match(/^Cook\s*Time:\s*(.+)$/i);
          if (cookMatch) {
            cookMinutes = parseTimeToMinutes(cookMatch[1]);
          }
          const totalMatch = line.match(/^Total\s*Time:\s*(.+)$/i);
          if (totalMatch) {
            totalMinutes = parseTimeToMinutes(totalMatch[1]);
          }
        }

        // Compute total from prep + cook if both available
        if (prepMinutes !== null && cookMinutes !== null) {
          totalMinutes = prepMinutes + cookMinutes;
        } else if (totalMinutes === null) {
          // Fall back to parseRecipeTotalMinutes for total
          totalMinutes = parseRecipeTotalMinutes(row.content);
        }

        // Only update if we found at least one value
        if (prepMinutes !== null || cookMinutes !== null || totalMinutes !== null) {
          updateStmt.run(prepMinutes, cookMinutes, totalMinutes, row.id);
        }
      }

      logger.info({ recipeCount: recipes.length }, "Backfilled recipe time columns");
    },
  },
  {
    version: 7,
    name: "expand-meal-type-enum",
    up: (_sqlite) => {
      // App-level change only: expanded MealType enum from 3 values
      // (breakfast, lunch, dinner) to 6 values (breakfast, lunch, snack,
      // dinner, dessert, other) in Drizzle schema and TypeScript types.
      // SQLite TEXT columns accept any string, so no DDL is needed.
      // Existing 'dinner' default entries remain valid.
    },
  },
  {
    version: 8,
    name: "add-meal-time-columns",
    up: (sqlite) => {
      // On fresh install, reminder_settings may not exist yet (created later by initializeReminders).
      const tableExists = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reminder_settings'")
        .get();
      if (!tableExists) return;

      const columns = sqlite.pragma("table_info(reminder_settings)") as Array<{ name: string }>;

      const newColumns: Array<{ name: string; defaultValue: string }> = [
        { name: "breakfast_time", defaultValue: "07:00" },
        { name: "lunch_time", defaultValue: "12:00" },
        { name: "snack_time", defaultValue: "15:00" },
        { name: "dessert_time", defaultValue: "20:00" },
      ];

      for (const col of newColumns) {
        if (!columns.some((c) => c.name === col.name)) {
          sqlite.exec(
            `ALTER TABLE reminder_settings ADD COLUMN ${col.name} TEXT NOT NULL DEFAULT '${col.defaultValue}'`,
          );
        }
      }
    },
  },
  {
    version: 9,
    name: "create-memories-table-and-rename-settings",
    up: (sqlite) => {
      // Create memories table for atomic facts
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS memories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          household_id TEXT NOT NULL,
          content TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'general',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `);
      sqlite.exec(
        `CREATE INDEX IF NOT EXISTS idx_memories_household ON memories(household_id)`,
      );

      // Rename reminder_settings -> application_settings
      const tableExists = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='reminder_settings'",
        )
        .get();
      if (tableExists) {
        sqlite.exec(
          `ALTER TABLE reminder_settings RENAME TO application_settings`,
        );
      }
    },
  },
  {
    version: 10,
    name: "migrate-preferences-to-memories",
    up: (sqlite) => {
      // On fresh installs, runMigrations() runs before initializeFts() (see
      // src/db/index.ts), so knowledge_items doesn't exist yet. There's
      // nothing to migrate in that case -- a brand-new database has no
      // preference-tagged knowledge_items either -- so skip.
      const knowledgeItemsExists = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_items'")
        .get();
      if (!knowledgeItemsExists) return;

      // Query all preference-tagged knowledge_items
      const rows = sqlite
        .prepare(
          `SELECT ki.id, ki.household_id, ki.title, ki.summary,
                  GROUP_CONCAT(kt.tag, ',') AS tags
           FROM knowledge_items ki
           JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id
           WHERE ki.id IN (
             SELECT knowledge_item_id FROM knowledge_tags
             WHERE tag = 'preference' OR tag LIKE 'pref:%'
           )
           GROUP BY ki.id`,
        )
        .all() as Array<{
        id: number;
        household_id: string;
        title: string;
        summary: string;
        tags: string;
      }>;

      if (rows.length === 0) return;

      const insertStmt = sqlite.prepare(
        `INSERT INTO memories (household_id, content, category) VALUES (?, ?, ?)`,
      );

      const idsToDelete: number[] = [];

      for (const row of rows) {
        const tags = row.tags.split(",");

        // Skip items that are also tagged as recipes -- leave those in knowledge_items
        if (tags.includes("recipe")) continue;

        // Determine category from tags
        let category = "general";
        if (tags.some((t) => t === "pref:dietary")) {
          category = "dietary";
        } else if (tags.some((t) => t === "pref:schedule")) {
          category = "schedule";
        } else if (tags.some((t) => t === "pref:grocery")) {
          category = "logistics";
        } else if (
          tags.some(
            (t) =>
              t === "pref:cooking" ||
              t === "pref:budget" ||
              t === "pref:serving",
          )
        ) {
          category = "cooking_style";
        } else if (tags.some((t) => t === "subject:household")) {
          category = "household";
        }

        // Build content with severity markers
        let content = `${row.title}: ${row.summary}`;
        if (
          tags.some(
            (t) => t === "severity:allergy" || t === "severity:restriction",
          )
        ) {
          const marker = tags.includes("severity:allergy")
            ? "[ALLERGY]"
            : "[RESTRICTION]";
          content = `${marker} ${content}`;
        }

        insertStmt.run(row.household_id, content, category);
        idsToDelete.push(row.id);
      }

      // Delete migrated rows from knowledge_items (tags cascade-delete)
      if (idsToDelete.length > 0) {
        const placeholders = idsToDelete.map(() => "?").join(",");
        sqlite
          .prepare(
            `DELETE FROM knowledge_items WHERE id IN (${placeholders})`,
          )
          .run(...idsToDelete);
      }

      logger.info(
        { migratedCount: idsToDelete.length, totalPrefs: rows.length },
        "Migrated preferences from knowledge_items to memories",
      );
    },
  },
  {
    version: 11,
    name: "fix-grocery-memory-category",
    up: (sqlite) => {
      // Migration v10 incorrectly mapped pref:grocery to cooking_style.
      // Re-categorize grocery/store-related memories to logistics.
      const result = sqlite
        .prepare(
          `UPDATE memories SET category = 'logistics'
           WHERE category = 'cooking_style'
             AND (content LIKE '%store%' OR content LIKE '%shop%'
               OR content LIKE '%grocery%' OR content LIKE '%Costco%'
               OR content LIKE '%Kroger%' OR content LIKE '%Walmart%'
               OR content LIKE '%Aldi%' OR content LIKE '%HyVee%'
               OR content LIKE '%Harris Teeter%' OR content LIKE '%Food Lion%'
               OR content LIKE '%delivery%')`,
        )
        .run();
      if (result.changes > 0) {
        logger.info(
          { updated: result.changes },
          "Re-categorized grocery memories from cooking_style to logistics",
        );
      }
    },
  },
];

export function runMigrations(sqlite: BetterSqlite3.Database): void {
  const currentVersion = sqlite.pragma("user_version", {
    simple: true,
  }) as number;

  // Validate sequential version numbers with no gaps
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].version !== i + 1) {
      throw new Error(
        `Non-sequential migration versions: expected ${i + 1}, got ${sorted[i].version}`,
      );
    }
  }

  const pending = sorted.filter((m) => m.version > currentVersion);

  if (pending.length === 0) {
    return;
  }

  logger.info({ currentVersion, pendingCount: pending.length }, "Running database migrations");

  for (const migration of pending) {
    logger.info({ version: migration.version, name: migration.name }, "Applying migration");

    sqlite.transaction(() => {
      migration.up(sqlite);
      sqlite.pragma(`user_version = ${migration.version}`);
    })();

    logger.info({ version: migration.version, name: migration.name }, "Migration applied");
  }

  const newVersion = sqlite.pragma("user_version", { simple: true }) as number;
  logger.info({ newVersion }, "All migrations complete");
}
