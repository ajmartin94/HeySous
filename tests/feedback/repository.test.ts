import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createFeedbackRepository } from "../../src/feedback/repository.js";
import { initializeFeedback } from "../../src/feedback/init.js";

const HOUSEHOLD_ID = "test-household";

/**
 * Set up an in-memory DB with the feedback_checkins and reminders tables.
 * The reminders table is needed because expireOldCheckins now joins against it
 * to distinguish orphaned/undelivered pending rows from genuinely-future ones.
 */
function setupDatabase(): InstanceType<typeof Database> {
  const db = new Database(":memory:");
  initializeFeedback(db);
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
  return db;
}

/** Insert a reminder row directly, returning its id. */
function insertReminder(
  db: InstanceType<typeof Database>,
  opts: { status?: string; dueAt?: number } = {},
): number {
  const result = db
    .prepare(
      `INSERT INTO reminders (household_id, type, due_at, status)
       VALUES (?, 'feedback_checkin', ?, ?)`,
    )
    .run(
      HOUSEHOLD_ID,
      opts.dueAt ?? Math.floor(Date.now() / 1000) + 3600,
      opts.status ?? "pending",
    );
  return Number(result.lastInsertRowid);
}

/** Insert a checkin row directly with control over status/created_at. */
function insertCheckin(
  db: InstanceType<typeof Database>,
  opts: { reminderId: number; status?: string; ageSeconds?: number },
): number {
  const createdAt =
    Math.floor(Date.now() / 1000) - (opts.ageSeconds ?? 0);
  const result = db
    .prepare(
      `INSERT INTO feedback_checkins (household_id, reminder_id, meals_json, status, created_at)
       VALUES (?, ?, '[]', ?, ?)`,
    )
    .run(HOUSEHOLD_ID, opts.reminderId, opts.status ?? "pending", createdAt);
  return Number(result.lastInsertRowid);
}

function statusOf(db: InstanceType<typeof Database>, id: number): string {
  const row = db
    .prepare("SELECT status FROM feedback_checkins WHERE id = ?")
    .get(id) as { status: string };
  return row.status;
}

describe("feedback repository -- markCheckinSent", () => {
  let sqlite: InstanceType<typeof Database>;

  beforeEach(() => {
    sqlite = setupDatabase();
  });
  afterEach(() => {
    sqlite.close();
  });

  it("transitions a pending check-in to sent", () => {
    const repo = createFeedbackRepository(sqlite);
    const reminderId = insertReminder(sqlite);
    const checkin = repo.createCheckin({
      householdId: HOUSEHOLD_ID,
      reminderId,
      mealsJson: "[]",
    });
    expect(checkin.status).toBe("pending");

    repo.markCheckinSent(checkin.id);

    expect(statusOf(sqlite, checkin.id)).toBe("sent");
  });

  it("does not clobber a responded check-in back to sent", () => {
    const repo = createFeedbackRepository(sqlite);
    const reminderId = insertReminder(sqlite);
    const id = insertCheckin(sqlite, { reminderId, status: "responded" });

    repo.markCheckinSent(id);

    expect(statusOf(sqlite, id)).toBe("responded");
  });

  it("makes a sent check-in visible to getPendingSentCheckins (free-text matching)", () => {
    const repo = createFeedbackRepository(sqlite);
    const reminderId = insertReminder(sqlite);
    const checkin = repo.createCheckin({
      householdId: HOUSEHOLD_ID,
      reminderId,
      mealsJson: "[]",
    });

    // Before marking sent, it is invisible (this was the pre-fix broken state).
    expect(repo.getPendingSentCheckins(HOUSEHOLD_ID)).toHaveLength(0);

    repo.markCheckinSent(checkin.id);

    expect(repo.getPendingSentCheckins(HOUSEHOLD_ID)).toHaveLength(1);
  });
});

describe("feedback repository -- expireOldCheckins", () => {
  let sqlite: InstanceType<typeof Database>;

  beforeEach(() => {
    sqlite = setupDatabase();
  });
  afterEach(() => {
    sqlite.close();
  });

  const DAY = 86400;

  it("expires stale sent check-ins (24h+) that were never answered", () => {
    const repo = createFeedbackRepository(sqlite);
    const reminderId = insertReminder(sqlite, { status: "sent" });
    const id = insertCheckin(sqlite, {
      reminderId,
      status: "sent",
      ageSeconds: DAY + 100,
    });

    repo.expireOldCheckins();

    expect(statusOf(sqlite, id)).toBe("expired");
  });

  it("expires orphaned pending check-ins whose reminder was deleted (the backlog)", () => {
    const repo = createFeedbackRepository(sqlite);
    // Orphan: reminder id 999 never existed / was deleted by regeneration.
    const id = insertCheckin(sqlite, {
      reminderId: 999,
      status: "pending",
      ageSeconds: DAY + 100,
    });

    repo.expireOldCheckins();

    expect(statusOf(sqlite, id)).toBe("expired");
  });

  it("expires pending check-ins whose reminder already fired (non-pending)", () => {
    const repo = createFeedbackRepository(sqlite);
    const reminderId = insertReminder(sqlite, { status: "sent" });
    const id = insertCheckin(sqlite, {
      reminderId,
      status: "pending",
      ageSeconds: DAY + 100,
    });

    repo.expireOldCheckins();

    expect(statusOf(sqlite, id)).toBe("expired");
  });

  it("does NOT expire a future pending check-in backed by a live pending reminder", () => {
    const repo = createFeedbackRepository(sqlite);
    const reminderId = insertReminder(sqlite, {
      status: "pending",
      dueAt: Math.floor(Date.now() / 1000) + 3 * DAY,
    });
    // Even if the tracking row is a couple days old, a live reminder protects it.
    const id = insertCheckin(sqlite, {
      reminderId,
      status: "pending",
      ageSeconds: 2 * DAY,
    });

    repo.expireOldCheckins();

    expect(statusOf(sqlite, id)).toBe("pending");
  });

  it("does NOT expire recently-created pending check-ins (< 24h)", () => {
    const repo = createFeedbackRepository(sqlite);
    const id = insertCheckin(sqlite, {
      reminderId: 999,
      status: "pending",
      ageSeconds: 3600,
    });

    repo.expireOldCheckins();

    expect(statusOf(sqlite, id)).toBe("pending");
  });

  it("leaves responded check-ins untouched", () => {
    const repo = createFeedbackRepository(sqlite);
    const id = insertCheckin(sqlite, {
      reminderId: 999,
      status: "responded",
      ageSeconds: 10 * DAY,
    });

    repo.expireOldCheckins();

    expect(statusOf(sqlite, id)).toBe("responded");
  });
});
