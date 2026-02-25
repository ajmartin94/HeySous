import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import {
  parseTimeToMinutes,
  parseRecipeTotalMinutes,
  generateReminders,
} from "../../src/reminders/generator.js";
import { createReminderRepository } from "../../src/reminders/repository.js";
import { createTestClock } from "../../src/clock.js";
import { initializeFts } from "../../src/knowledge/fts.js";

// Mock logger so we can spy on calls -- inline to avoid hoisting issues
vi.mock("../../src/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock config for logger module (some test paths import it transitively)
vi.mock("../../src/config.js", () => ({
  config: {
    isDev: true,
    logLevel: "silent",
    adminUserId: "test-admin",
    adminUserIds: [],
  },
}));

// Import the mocked logger for assertions
import { logger as mockLoggerImport } from "../../src/logger.js";
const mockLogger = mockLoggerImport as unknown as {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
};

const HOUSEHOLD_ID = "test-household";

// ---------------------------------------------------------------------------
// Unit tests for parseTimeToMinutes
// ---------------------------------------------------------------------------
describe("parseTimeToMinutes", () => {
  it("parses '30 minutes' to 30", () => {
    expect(parseTimeToMinutes("30 minutes")).toBe(30);
  });

  it("parses '1 hour 30 minutes' to 90", () => {
    expect(parseTimeToMinutes("1 hour 30 minutes")).toBe(90);
  });

  it("parses '45 min' to 45", () => {
    expect(parseTimeToMinutes("45 min")).toBe(45);
  });

  it("parses '1:30' (H:MM) to 90", () => {
    expect(parseTimeToMinutes("1:30")).toBe(90);
  });

  it("parses '2 hrs' to 120", () => {
    expect(parseTimeToMinutes("2 hrs")).toBe(120);
  });

  it("returns null for unparseable string", () => {
    expect(parseTimeToMinutes("until golden")).toBeNull();
  });

  it("parses bare number as minutes", () => {
    expect(parseTimeToMinutes("60")).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// Unit tests for parseRecipeTotalMinutes
// ---------------------------------------------------------------------------
describe("parseRecipeTotalMinutes", () => {
  it("returns correct total when both Prep Time and Cook Time are present", () => {
    const content = `Prep Time: 15 minutes\nCook Time: 30 minutes\n\nIngredients:\n- chicken`;
    expect(parseRecipeTotalMinutes(content)).toBe(45);
  });

  it("returns Total Time when only that line is present", () => {
    const content = `Total Time: 1 hour 15 minutes\n\nIngredients:\n- pasta`;
    expect(parseRecipeTotalMinutes(content)).toBe(75);
  });

  it("returns null when no time lines are found in content", () => {
    const content = `Ingredients:\n- flour\n- sugar\n\nSteps:\n1. Mix ingredients`;
    expect(parseRecipeTotalMinutes(content)).toBeNull();
  });

  it("handles H:MM format", () => {
    const content = `Prep Time: 0:15\nCook Time: 1:15`;
    expect(parseRecipeTotalMinutes(content)).toBe(90);
  });

  it("handles various formats: '30 minutes', '1 hour 30 minutes', '45 min'", () => {
    expect(parseRecipeTotalMinutes("Prep Time: 30 minutes\nCook Time: 1 hour")).toBe(90);
    expect(parseRecipeTotalMinutes("Total Time: 45 min")).toBe(45);
  });
});

// ---------------------------------------------------------------------------
// Integration tests for generateReminders start_cooking behavior
// ---------------------------------------------------------------------------
describe("generateReminders start_cooking behavior", () => {
  let sqlite: InstanceType<typeof Database>;
  let clock: ReturnType<typeof createTestClock>;

  /**
   * Helper: set up in-memory SQLite with all required tables
   */
  function setupDatabase(): InstanceType<typeof Database> {
    const db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    // knowledge_items + knowledge_tags (via FTS init which creates base tables)
    initializeFts(db);

    // meal_plans
    db.exec(`
      CREATE TABLE IF NOT EXISTS meal_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id TEXT NOT NULL,
        week_start_date TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        version INTEGER NOT NULL DEFAULT 1,
        updated_by TEXT
      )
    `);

    // meal_plan_entries
    db.exec(`
      CREATE TABLE IF NOT EXISTS meal_plan_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL,
        meal_type TEXT NOT NULL DEFAULT 'dinner',
        recipe_name TEXT NOT NULL,
        knowledge_item_id INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // reminders
    db.exec(`
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id TEXT NOT NULL,
        type TEXT NOT NULL,
        due_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        context_json TEXT NOT NULL DEFAULT '{}',
        generated_text TEXT,
        sent_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // reminder_settings
    db.exec(`
      CREATE TABLE IF NOT EXISTS reminder_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id TEXT NOT NULL UNIQUE,
        timezone TEXT NOT NULL DEFAULT 'America/New_York',
        morning_time TEXT NOT NULL DEFAULT '08:00',
        dinner_time TEXT NOT NULL DEFAULT '17:30',
        morning_enabled INTEGER NOT NULL DEFAULT 1,
        prep_alerts_enabled INTEGER NOT NULL DEFAULT 1,
        muted_until INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    return db;
  }

  /**
   * Helper: create a plan with one dinner entry for a specific date
   */
  function createDinnerPlan(
    db: InstanceType<typeof Database>,
    opts: {
      weekStartDate: string;
      dayOfWeek: number;
      recipeName: string;
      knowledgeItemId: number | null;
    },
  ): void {
    const plan = db
      .prepare(
        "INSERT INTO meal_plans (household_id, week_start_date) VALUES (?, ?)",
      )
      .run(HOUSEHOLD_ID, opts.weekStartDate);

    db.prepare(
      "INSERT INTO meal_plan_entries (plan_id, day_of_week, meal_type, recipe_name, knowledge_item_id) VALUES (?, ?, 'dinner', ?, ?)",
    ).run(plan.lastInsertRowid, opts.dayOfWeek, opts.recipeName, opts.knowledgeItemId);
  }

  /**
   * Helper: create a knowledge item with optional structured time and content
   */
  function createKnowledgeItem(
    db: InstanceType<typeof Database>,
    opts: {
      id: number;
      title: string;
      content: string;
      prepTimeMinutes?: number | null;
      cookTimeMinutes?: number | null;
      totalTimeMinutes?: number | null;
    },
  ): void {
    db.prepare(
      `INSERT INTO knowledge_items (id, household_id, title, summary, content, prep_time_minutes, cook_time_minutes, total_time_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      opts.id,
      HOUSEHOLD_ID,
      opts.title,
      "A recipe",
      opts.content,
      opts.prepTimeMinutes ?? null,
      opts.cookTimeMinutes ?? null,
      opts.totalTimeMinutes ?? null,
    );

    db.prepare(
      "INSERT INTO knowledge_tags (knowledge_item_id, tag) VALUES (?, 'recipe')",
    ).run(opts.id);
  }

  /**
   * Helper: create a mock plan repository for generateReminders
   */
  function createMockPlanRepo(db: InstanceType<typeof Database>) {
    return {
      getActivePlans(householdId: string) {
        const plans = db
          .prepare("SELECT * FROM meal_plans WHERE household_id = ?")
          .all(householdId) as Array<{
          id: number;
          household_id: string;
          week_start_date: string;
          version: number;
          updated_by: string | null;
        }>;

        return plans.map((plan) => {
          const entries = db
            .prepare("SELECT * FROM meal_plan_entries WHERE plan_id = ?")
            .all(plan.id) as Array<{
            id: number;
            day_of_week: number;
            meal_type: string;
            recipe_name: string;
            knowledge_item_id: number | null;
          }>;

          return {
            id: plan.id,
            weekStartDate: plan.week_start_date,
            entries: entries.map((e) => ({
              id: e.id,
              dayOfWeek: e.day_of_week,
              mealType: e.meal_type,
              recipeName: e.recipe_name,
              knowledgeItemId: e.knowledge_item_id,
            })),
            version: plan.version,
            updatedBy: plan.updated_by ?? null,
          };
        });
      },
      getPlan() {
        return null;
      },
      savePlan() {
        return null;
      },
    };
  }

  beforeEach(() => {
    sqlite = setupDatabase();
    // Set clock to Monday 2026-02-23 at 06:00 UTC (01:00 AM Eastern)
    // This ensures all reminders for the day are in the future
    clock = createTestClock(new Date("2026-02-23T06:00:00Z"));
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.debug.mockClear();
  });

  afterEach(() => {
    sqlite.close();
  });

  it("uses structured metadata when content parsing has no time lines", () => {
    // Knowledge item with NO time lines in content but total_time_minutes = 60 in column
    createKnowledgeItem(sqlite, {
      id: 1,
      title: "Slow Braised Beef",
      content: "Ingredients:\n- beef\n- onions\n\nSteps:\n1. Braise the beef",
      totalTimeMinutes: 60,
    });

    // Dinner entry on Monday (day 0) of week starting 2026-02-23
    createDinnerPlan(sqlite, {
      weekStartDate: "2026-02-23",
      dayOfWeek: 0,
      recipeName: "Slow Braised Beef",
      knowledgeItemId: 1,
    });

    const reminderRepo = createReminderRepository(sqlite, clock);
    const planRepo = createMockPlanRepo(sqlite);

    generateReminders({
      reminderRepository: reminderRepo,
      planRepository: planRepo as ReturnType<typeof import("../../src/planning/repository.js").createPlanRepository>,
      sqlite,
      householdId: HOUSEHOLD_ID,
      settings: {
        id: 1,
        householdId: HOUSEHOLD_ID,
        timezone: "America/New_York",
        morningTime: "08:00",
        dinnerTime: "17:30",
        morningEnabled: false,
        prepAlertsEnabled: false,
        mutedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      clock,
    });

    // Get the start_cooking reminder
    const reminders = sqlite
      .prepare("SELECT * FROM reminders WHERE type = 'start_cooking'")
      .all() as Array<{ due_at: number; type: string }>;

    expect(reminders).toHaveLength(1);

    // Dinner time is 17:30 ET = 22:30 UTC. Recipe is 60 min, so reminder should be at 16:30 ET = 21:30 UTC.
    const dueAt = new Date(reminders[0].due_at * 1000);
    const dueHoursUtc = dueAt.getUTCHours();
    const dueMinutesUtc = dueAt.getUTCMinutes();

    // 16:30 ET = 21:30 UTC (Eastern Standard Time = UTC-5)
    expect(dueHoursUtc).toBe(21);
    expect(dueMinutesUtc).toBe(30);
  });

  it("uses 45-minute default when no time source is available", () => {
    // Knowledge item with no time data at all
    createKnowledgeItem(sqlite, {
      id: 2,
      title: "Mystery Casserole",
      content: "Ingredients:\n- stuff\n\nSteps:\n1. Cook it",
    });

    createDinnerPlan(sqlite, {
      weekStartDate: "2026-02-23",
      dayOfWeek: 0,
      recipeName: "Mystery Casserole",
      knowledgeItemId: 2,
    });

    const reminderRepo = createReminderRepository(sqlite, clock);
    const planRepo = createMockPlanRepo(sqlite);

    generateReminders({
      reminderRepository: reminderRepo,
      planRepository: planRepo as ReturnType<typeof import("../../src/planning/repository.js").createPlanRepository>,
      sqlite,
      householdId: HOUSEHOLD_ID,
      settings: {
        id: 1,
        householdId: HOUSEHOLD_ID,
        timezone: "America/New_York",
        morningTime: "08:00",
        dinnerTime: "17:30",
        morningEnabled: false,
        prepAlertsEnabled: false,
        mutedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      clock,
    });

    const reminders = sqlite
      .prepare("SELECT * FROM reminders WHERE type = 'start_cooking'")
      .all() as Array<{ due_at: number }>;

    expect(reminders).toHaveLength(1);

    // Dinner time is 17:30 ET. Default 45 min => 16:45 ET = 21:45 UTC
    const dueAt = new Date(reminders[0].due_at * 1000);
    expect(dueAt.getUTCHours()).toBe(21);
    expect(dueAt.getUTCMinutes()).toBe(45);
  });

  it("structured metadata takes priority over content parsing", () => {
    // Knowledge item with Cook Time: 30 minutes in content AND total_time_minutes = 90 in column
    createKnowledgeItem(sqlite, {
      id: 3,
      title: "Priority Test Recipe",
      content: "Cook Time: 30 minutes\n\nIngredients:\n- chicken\n\nSteps:\n1. Cook",
      totalTimeMinutes: 90,
    });

    createDinnerPlan(sqlite, {
      weekStartDate: "2026-02-23",
      dayOfWeek: 0,
      recipeName: "Priority Test Recipe",
      knowledgeItemId: 3,
    });

    const reminderRepo = createReminderRepository(sqlite, clock);
    const planRepo = createMockPlanRepo(sqlite);

    generateReminders({
      reminderRepository: reminderRepo,
      planRepository: planRepo as ReturnType<typeof import("../../src/planning/repository.js").createPlanRepository>,
      sqlite,
      householdId: HOUSEHOLD_ID,
      settings: {
        id: 1,
        householdId: HOUSEHOLD_ID,
        timezone: "America/New_York",
        morningTime: "08:00",
        dinnerTime: "17:30",
        morningEnabled: false,
        prepAlertsEnabled: false,
        mutedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      clock,
    });

    const reminders = sqlite
      .prepare("SELECT * FROM reminders WHERE type = 'start_cooking'")
      .all() as Array<{ due_at: number }>;

    expect(reminders).toHaveLength(1);

    // Structured column (90 min) should be used, NOT content-parsed (30 min).
    // Dinner 17:30 - 90 min = 16:00 ET = 21:00 UTC
    const dueAt = new Date(reminders[0].due_at * 1000);
    expect(dueAt.getUTCHours()).toBe(21);
    expect(dueAt.getUTCMinutes()).toBe(0);
  });

  it("replaces silent catch with logger.error", () => {
    // Create a dinner entry referencing a knowledge item
    createDinnerPlan(sqlite, {
      weekStartDate: "2026-02-23",
      dayOfWeek: 0,
      recipeName: "Error Recipe",
      knowledgeItemId: 999,
    });

    // Create a proxy that throws on the specific knowledge_items query
    const throwingSqlite = new Proxy(sqlite, {
      get(target, prop) {
        if (prop === "prepare") {
          return (sql: string) => {
            if (sql.includes("knowledge_items") && sql.includes("SELECT")) {
              return {
                get: () => {
                  throw new Error("Simulated DB error");
                },
              };
            }
            return target.prepare(sql);
          };
        }
        return (target as Record<string | symbol, unknown>)[prop];
      },
    });

    const reminderRepo = createReminderRepository(sqlite, clock);
    const planRepo = createMockPlanRepo(sqlite);

    generateReminders({
      reminderRepository: reminderRepo,
      planRepository: planRepo as ReturnType<typeof import("../../src/planning/repository.js").createPlanRepository>,
      sqlite: throwingSqlite as InstanceType<typeof Database>,
      householdId: HOUSEHOLD_ID,
      settings: {
        id: 1,
        householdId: HOUSEHOLD_ID,
        timezone: "America/New_York",
        morningTime: "08:00",
        dinnerTime: "17:30",
        morningEnabled: false,
        prepAlertsEnabled: false,
        mutedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      clock,
    });

    // Assert logger.error was called (not silently swallowed)
    expect(mockLogger.error).toHaveBeenCalled();
    const errorCall = mockLogger.error.mock.calls[0];
    expect(errorCall[0]).toHaveProperty("err");
    expect(errorCall[0].err.message).toBe("Simulated DB error");
  });

  it("logs at info level when falling back to default (no time data)", () => {
    // Knowledge item with no time data at all
    createKnowledgeItem(sqlite, {
      id: 4,
      title: "Timeless Recipe",
      content: "Ingredients:\n- stuff\n\nSteps:\n1. Make it",
    });

    createDinnerPlan(sqlite, {
      weekStartDate: "2026-02-23",
      dayOfWeek: 0,
      recipeName: "Timeless Recipe",
      knowledgeItemId: 4,
    });

    const reminderRepo = createReminderRepository(sqlite, clock);
    const planRepo = createMockPlanRepo(sqlite);

    generateReminders({
      reminderRepository: reminderRepo,
      planRepository: planRepo as ReturnType<typeof import("../../src/planning/repository.js").createPlanRepository>,
      sqlite,
      householdId: HOUSEHOLD_ID,
      settings: {
        id: 1,
        householdId: HOUSEHOLD_ID,
        timezone: "America/New_York",
        morningTime: "08:00",
        dinnerTime: "17:30",
        morningEnabled: false,
        prepAlertsEnabled: false,
        mutedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      clock,
    });

    // Assert logger.info was called indicating fallback
    expect(mockLogger.info).toHaveBeenCalled();
    const infoCalls = mockLogger.info.mock.calls;
    const fallbackCall = infoCalls.find(
      (call: unknown[]) =>
        typeof call[0] === "object" &&
        call[0] !== null &&
        "reason" in (call[0] as Record<string, unknown>) &&
        (call[0] as Record<string, unknown>).reason === "no_time_data",
    );
    expect(fallbackCall).toBeDefined();
  });

  it("uses 45-min default when knowledgeItemId is null", () => {
    // Dinner entry with NO knowledgeItemId
    createDinnerPlan(sqlite, {
      weekStartDate: "2026-02-23",
      dayOfWeek: 0,
      recipeName: "Quick Salad",
      knowledgeItemId: null,
    });

    const reminderRepo = createReminderRepository(sqlite, clock);
    const planRepo = createMockPlanRepo(sqlite);

    generateReminders({
      reminderRepository: reminderRepo,
      planRepository: planRepo as ReturnType<typeof import("../../src/planning/repository.js").createPlanRepository>,
      sqlite,
      householdId: HOUSEHOLD_ID,
      settings: {
        id: 1,
        householdId: HOUSEHOLD_ID,
        timezone: "America/New_York",
        morningTime: "08:00",
        dinnerTime: "17:30",
        morningEnabled: false,
        prepAlertsEnabled: false,
        mutedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      clock,
    });

    const reminders = sqlite
      .prepare("SELECT * FROM reminders WHERE type = 'start_cooking'")
      .all() as Array<{ due_at: number }>;

    expect(reminders).toHaveLength(1);

    // Dinner 17:30 - 45 min default = 16:45 ET = 21:45 UTC
    const dueAt = new Date(reminders[0].due_at * 1000);
    expect(dueAt.getUTCHours()).toBe(21);
    expect(dueAt.getUTCMinutes()).toBe(45);

    // Also verify logger.info was called for no_knowledge_item_id
    const infoCalls = mockLogger.info.mock.calls;
    const fallbackCall = infoCalls.find(
      (call: unknown[]) =>
        typeof call[0] === "object" &&
        call[0] !== null &&
        "reason" in (call[0] as Record<string, unknown>) &&
        (call[0] as Record<string, unknown>).reason === "no_knowledge_item_id",
    );
    expect(fallbackCall).toBeDefined();
  });

  it("deletes sent reminders during regeneration (no phantom alerts)", () => {
    // 1. Create a knowledge item
    createKnowledgeItem(sqlite, {
      id: 5,
      title: "Old Chicken Recipe",
      content: "Cook Time: 30 minutes\n\nIngredients:\n- chicken\n\nSteps:\n1. Cook",
    });

    // 2. Create a dinner plan for day 1 (Tuesday) of week 2026-02-23
    createDinnerPlan(sqlite, {
      weekStartDate: "2026-02-23",
      dayOfWeek: 1,
      recipeName: "Old Chicken Recipe",
      knowledgeItemId: 5,
    });

    // 3. Create repositories
    const reminderRepo = createReminderRepository(sqlite, clock);
    const planRepo = createMockPlanRepo(sqlite);

    // 4. Call generateReminders once to create initial reminders
    generateReminders({
      reminderRepository: reminderRepo,
      planRepository: planRepo as ReturnType<typeof import("../../src/planning/repository.js").createPlanRepository>,
      sqlite,
      householdId: HOUSEHOLD_ID,
      settings: {
        id: 1,
        householdId: HOUSEHOLD_ID,
        timezone: "America/New_York",
        morningTime: "08:00",
        dinnerTime: "17:30",
        morningEnabled: true,
        prepAlertsEnabled: true,
        mutedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      clock,
    });

    // 5. Manually mark one of the created reminders as 'sent'
    //    (simulates the poller having already picked up the reminder)
    sqlite
      .prepare("UPDATE reminders SET status = 'sent' WHERE household_id = ?")
      .run(HOUSEHOLD_ID);

    // 6. Sanity check: at least one reminder now has status='sent'
    const sentBefore = sqlite
      .prepare("SELECT * FROM reminders WHERE household_id = ? AND status = 'sent'")
      .all(HOUSEHOLD_ID);
    expect(sentBefore.length).toBeGreaterThan(0);

    // 7. Call generateReminders again (simulating regeneration after plan change)
    generateReminders({
      reminderRepository: reminderRepo,
      planRepository: planRepo as ReturnType<typeof import("../../src/planning/repository.js").createPlanRepository>,
      sqlite,
      householdId: HOUSEHOLD_ID,
      settings: {
        id: 1,
        householdId: HOUSEHOLD_ID,
        timezone: "America/New_York",
        morningTime: "08:00",
        dinnerTime: "17:30",
        morningEnabled: true,
        prepAlertsEnabled: true,
        mutedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      clock,
    });

    // Assert: no reminders with status='sent' should remain
    const sentAfter = sqlite
      .prepare("SELECT * FROM reminders WHERE household_id = ? AND status = 'sent'")
      .all(HOUSEHOLD_ID) as Array<Record<string, unknown>>;
    expect(sentAfter).toHaveLength(0);
  });
});
