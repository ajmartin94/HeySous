import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { generateReminders } from "../../src/reminders/generator.js";
import { generateFeedbackCheckins } from "../../src/feedback/generator.js";
import { createReminderRepository } from "../../src/reminders/repository.js";
import { createFeedbackRepository } from "../../src/feedback/repository.js";
import { initializeFeedback } from "../../src/feedback/init.js";
import { createTestClock } from "../../src/clock.js";
import type { ReminderSettings } from "../../src/reminders/types.js";
import type { createPlanRepository } from "../../src/planning/repository.js";

// The reminders generator imports the real logger; silence it.
vi.mock("../../src/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const HOUSEHOLD_ID = "test-household";

function setupDatabase(): InstanceType<typeof Database> {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE meal_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      household_id TEXT NOT NULL,
      week_start_date TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT
    )
  `);
  db.exec(`
    CREATE TABLE meal_plan_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      meal_type TEXT NOT NULL DEFAULT 'dinner',
      recipe_name TEXT NOT NULL,
      knowledge_item_id INTEGER
    )
  `);
  db.exec(`
    CREATE TABLE reminders (
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
  initializeFeedback(db);
  return db;
}

function createDinnerPlan(
  db: InstanceType<typeof Database>,
  opts: { weekStartDate: string; dayOfWeek: number; recipeName: string },
): void {
  const plan = db
    .prepare("INSERT INTO meal_plans (household_id, week_start_date) VALUES (?, ?)")
    .run(HOUSEHOLD_ID, opts.weekStartDate);
  db.prepare(
    "INSERT INTO meal_plan_entries (plan_id, day_of_week, meal_type, recipe_name, knowledge_item_id) VALUES (?, ?, 'dinner', ?, NULL)",
  ).run(plan.lastInsertRowid, opts.dayOfWeek, opts.recipeName);
}

function createMockPlanRepo(db: InstanceType<typeof Database>) {
  return {
    getActivePlans(householdId: string) {
      const plans = db
        .prepare("SELECT * FROM meal_plans WHERE household_id = ?")
        .all(householdId) as Array<{ id: number; week_start_date: string; version: number; updated_by: string | null }>;
      return plans.map((plan) => {
        const entries = db
          .prepare("SELECT * FROM meal_plan_entries WHERE plan_id = ?")
          .all(plan.id) as Array<{ id: number; day_of_week: number; meal_type: string; recipe_name: string; knowledge_item_id: number | null }>;
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

const SETTINGS: ReminderSettings = {
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
};

describe("feedback check-in generation across reminder regeneration", () => {
  let sqlite: InstanceType<typeof Database>;
  let clock: ReturnType<typeof createTestClock>;

  beforeEach(() => {
    sqlite = setupDatabase();
    // Monday 2026-02-23 01:00 ET -- the day's 20:30 check-in is still in the future.
    clock = createTestClock(new Date("2026-02-23T06:00:00Z"));
    createDinnerPlan(sqlite, {
      weekStartDate: "2026-02-23",
      dayOfWeek: 0,
      recipeName: "Chicken Parm",
    });
  });
  afterEach(() => {
    sqlite.close();
  });

  function regenerate(): void {
    const reminderRepository = createReminderRepository(sqlite, clock);
    const feedbackRepository = createFeedbackRepository(sqlite);
    const planRepository = createMockPlanRepo(sqlite) as unknown as ReturnType<
      typeof createPlanRepository
    >;
    generateReminders({ reminderRepository, planRepository, sqlite, householdId: HOUSEHOLD_ID, settings: SETTINGS, clock });
    generateFeedbackCheckins({ feedbackRepository, reminderRepository, planRepository, sqlite, householdId: HOUSEHOLD_ID, settings: SETTINGS, clock });
  }

  function countCheckins(): number {
    return (sqlite.prepare("SELECT COUNT(*) AS n FROM feedback_checkins").get() as { n: number }).n;
  }

  function countOrphanedCheckins(): number {
    return (
      sqlite
        .prepare(
          `SELECT COUNT(*) AS n FROM feedback_checkins fc
           LEFT JOIN reminders r ON r.id = fc.reminder_id
           WHERE r.id IS NULL`,
        )
        .get() as { n: number }
    ).n;
  }

  it("creates exactly one check-in for a planned day on first generation", () => {
    regenerate();
    expect(countCheckins()).toBe(1);
    expect(countOrphanedCheckins()).toBe(0);
  });

  it("does not duplicate or orphan check-ins when reminders are regenerated (the prod bug)", () => {
    regenerate();
    // Regeneration happens on every plan edit and on every restart. Pre-fix,
    // generateReminders wiped the feedback_checkin reminders, orphaning the
    // tracking rows, and the generator recreated a fresh duplicate each time.
    regenerate();
    regenerate();

    expect(countCheckins()).toBe(1);
    expect(countOrphanedCheckins()).toBe(0);
  });

  it("keeps the feedback_checkin reminder alive across regeneration so it can still deliver", () => {
    regenerate();
    regenerate();

    const reminders = sqlite
      .prepare("SELECT * FROM reminders WHERE type = 'feedback_checkin'")
      .all() as Array<{ id: number; status: string }>;
    expect(reminders).toHaveLength(1);
    expect(reminders[0].status).toBe("pending");
  });
});
