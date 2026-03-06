import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { generateReminders } from "../../src/reminders/generator.js";
import { createReminderRepository } from "../../src/reminders/repository.js";
import { initializeReminders } from "../../src/reminders/init.js";
import { createTestClock } from "../../src/clock.js";
import { initializeFts } from "../../src/knowledge/fts.js";
import type { ReminderSettings } from "../../src/reminders/types.js";

// Mock logger
vi.mock("../../src/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../src/config.js", () => ({
  config: {
    isDev: true,
    logLevel: "silent",
    adminUserId: "test-admin",
    adminUserIds: [],
  },
}));

const HOUSEHOLD_ID = "test-household";
const MUTED_HOUSEHOLD_ID = "muted-household";

describe("Settings-to-Reminder Integration", () => {
  let sqlite: InstanceType<typeof Database>;
  let clock: ReturnType<typeof createTestClock>;

  function setupDatabase(): InstanceType<typeof Database> {
    const db = new Database(":memory:");
    db.pragma("journal_mode = WAL");

    // Use the real init for application_settings and reminders tables
    initializeReminders(db);

    // knowledge_items for FTS
    initializeFts(db);

    // meal_plans + entries
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

    return db;
  }

  function createMealPlan(
    db: InstanceType<typeof Database>,
    opts: {
      householdId?: string;
      weekStartDate: string;
      dayOfWeek: number;
      mealType: string;
      recipeName: string;
      knowledgeItemId: number | null;
    },
  ): void {
    const hid = opts.householdId ?? HOUSEHOLD_ID;
    const plan = db
      .prepare("INSERT INTO meal_plans (household_id, week_start_date) VALUES (?, ?)")
      .run(hid, opts.weekStartDate);

    db.prepare(
      "INSERT INTO meal_plan_entries (plan_id, day_of_week, meal_type, recipe_name, knowledge_item_id) VALUES (?, ?, ?, ?, ?)",
    ).run(plan.lastInsertRowid, opts.dayOfWeek, opts.mealType, opts.recipeName, opts.knowledgeItemId);
  }

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
      getPlan() { return null; },
      savePlan() { return null; },
    };
  }

  function defaultSettings(overrides?: Partial<ReminderSettings>): ReminderSettings {
    return {
      id: 1,
      householdId: HOUSEHOLD_ID,
      timezone: "America/New_York",
      morningTime: "08:00",
      breakfastTime: "07:00",
      lunchTime: "12:00",
      snackTime: "15:00",
      dinnerTime: "17:30",
      dessertTime: "20:00",
      morningEnabled: true,
      prepAlertsEnabled: true,
      mutedUntil: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  beforeEach(() => {
    sqlite = setupDatabase();
    // Monday 2026-02-23 at 06:00 UTC (01:00 AM Eastern)
    clock = createTestClock(new Date("2026-02-23T06:00:00Z"));
  });

  afterEach(() => {
    sqlite.close();
  });

  // ── Gap 2: prepAlertsEnabled gates start_cooking ──────────────────────

  it("generateReminders with morningEnabled=false produces no morning_summary rows", () => {
    createMealPlan(sqlite, {
      weekStartDate: "2026-02-23",
      dayOfWeek: 0,
      mealType: "dinner",
      recipeName: "Pasta",
      knowledgeItemId: null,
    });

    const reminderRepo = createReminderRepository(sqlite, clock);
    const planRepo = createMockPlanRepo(sqlite);

    generateReminders({
      reminderRepository: reminderRepo,
      planRepository: planRepo as ReturnType<typeof import("../../src/planning/repository.js").createPlanRepository>,
      sqlite,
      householdId: HOUSEHOLD_ID,
      settings: defaultSettings({ morningEnabled: false }),
      clock,
    });

    const morningReminders = sqlite
      .prepare("SELECT * FROM reminders WHERE type = 'morning_summary'")
      .all();

    expect(morningReminders).toHaveLength(0);
  });

  it("generateReminders with prepAlertsEnabled=false produces no start_cooking rows", () => {
    createMealPlan(sqlite, {
      weekStartDate: "2026-02-23",
      dayOfWeek: 0,
      mealType: "dinner",
      recipeName: "Steak",
      knowledgeItemId: null,
    });

    const reminderRepo = createReminderRepository(sqlite, clock);
    const planRepo = createMockPlanRepo(sqlite);

    generateReminders({
      reminderRepository: reminderRepo,
      planRepository: planRepo as ReturnType<typeof import("../../src/planning/repository.js").createPlanRepository>,
      sqlite,
      householdId: HOUSEHOLD_ID,
      settings: defaultSettings({ prepAlertsEnabled: false }),
      clock,
    });

    const startCookingReminders = sqlite
      .prepare("SELECT * FROM reminders WHERE type = 'start_cooking'")
      .all();

    expect(startCookingReminders).toHaveLength(0);
  });

  // ── Gap 3: Poller/getDueReminders checks muted_until ──────────────────

  it("getDueReminders excludes muted households", () => {
    const reminderRepo = createReminderRepository(sqlite, clock);

    // Create settings for a muted household (muted until 1 hour from now)
    const futureUnix = Math.floor(clock.now() / 1000) + 3600;
    sqlite.prepare(
      "INSERT INTO application_settings (household_id, muted_until) VALUES (?, ?)",
    ).run(MUTED_HOUSEHOLD_ID, futureUnix);

    // Create a pending reminder that is due now for the muted household
    const pastUnix = Math.floor(clock.now() / 1000) - 60;
    sqlite.prepare(
      "INSERT INTO reminders (household_id, type, due_at, status, context_json) VALUES (?, 'morning_summary', ?, 'pending', '{}')",
    ).run(MUTED_HOUSEHOLD_ID, pastUnix);

    const dueReminders = reminderRepo.getDueReminders();

    expect(dueReminders).toHaveLength(0);
  });

  it("getDueReminders includes households with expired mute", () => {
    const reminderRepo = createReminderRepository(sqlite, clock);

    // Create settings for a household whose mute expired 1 hour ago
    const pastUnix = Math.floor(clock.now() / 1000) - 3600;
    sqlite.prepare(
      "INSERT INTO application_settings (household_id, muted_until) VALUES (?, ?)",
    ).run(HOUSEHOLD_ID, pastUnix);

    // Create a pending reminder that is due now
    const dueUnix = Math.floor(clock.now() / 1000) - 60;
    sqlite.prepare(
      "INSERT INTO reminders (household_id, type, due_at, status, context_json) VALUES (?, 'morning_summary', ?, 'pending', '{}')",
    ).run(HOUSEHOLD_ID, dueUnix);

    const dueReminders = reminderRepo.getDueReminders();

    expect(dueReminders).toHaveLength(1);
    expect(dueReminders[0].householdId).toBe(HOUSEHOLD_ID);
  });

  it("getDueReminders includes households with no settings row (no mute)", () => {
    const reminderRepo = createReminderRepository(sqlite, clock);

    // No application_settings row for this household
    const dueUnix = Math.floor(clock.now() / 1000) - 60;
    sqlite.prepare(
      "INSERT INTO reminders (household_id, type, due_at, status, context_json) VALUES (?, 'morning_summary', ?, 'pending', '{}')",
    ).run("no-settings-household", dueUnix);

    const dueReminders = reminderRepo.getDueReminders();

    expect(dueReminders).toHaveLength(1);
    expect(dueReminders[0].householdId).toBe("no-settings-household");
  });
});
