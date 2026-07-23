import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { createFeedbackSender } from "../../src/feedback/sender.js";
import type { Reminder } from "../../src/reminders/types.js";
import type { FeedbackCheckin } from "../../src/feedback/types.js";

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

const parseEntitiesError = {
  error_code: 400,
  description: "Bad Request: can't parse entities",
};

function setupUsers(): InstanceType<typeof Database> {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      username TEXT,
      household_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      onboarding_state TEXT NOT NULL DEFAULT 'complete',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  db.prepare(
    "INSERT INTO users (telegram_id, display_name, household_id) VALUES ('999', 'Tester', 'h1')",
  ).run();
  return db;
}

function makeReminder(contextJson: string): Reminder {
  return {
    id: 1,
    householdId: "h1",
    type: "feedback_checkin",
    dueAt: new Date(),
    status: "sent",
    contextJson,
    generatedText: null,
    sentAt: null,
    createdAt: new Date(),
  };
}

const CHECKIN: FeedbackCheckin = {
  id: 1,
  householdId: "h1",
  reminderId: 1,
  mealsJson: "[]",
  status: "pending",
  sentiment: null,
  notes: null,
  respondedAt: null,
  createdAt: new Date(),
};

describe("feedback sender -- HTML safety", () => {
  let sqlite: InstanceType<typeof Database>;

  beforeEach(() => {
    sqlite = setupUsers();
  });
  afterEach(() => {
    sqlite.close();
  });

  it("escapes HTML special characters in recipe names", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const sender = createFeedbackSender({
      bot: { api: { sendMessage } },
      logger: makeLogger(),
      sqlite,
    });

    const reminder = makeReminder(
      JSON.stringify({
        date: "2026-02-23",
        meals: [{ mealType: "dinner", recipeName: "Mac & Cheese <deluxe>" }],
      }),
    );

    const ok = await sender.sendCheckin(reminder, CHECKIN);

    expect(ok).toBe(true);
    const sentText = sendMessage.mock.calls[0][1] as string;
    expect(sentText).toContain("Mac &amp; Cheese &lt;deluxe&gt;");
    expect(sentText).not.toContain("<deluxe>");
  });

  it("falls back to plain text if Telegram rejects entity parsing", async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(parseEntitiesError)
      .mockResolvedValueOnce(undefined);
    const sender = createFeedbackSender({
      bot: { api: { sendMessage } },
      logger: makeLogger(),
      sqlite,
    });

    const reminder = makeReminder(
      JSON.stringify({
        date: "2026-02-23",
        meals: [{ mealType: "dinner", recipeName: "Tacos" }],
      }),
    );

    const ok = await sender.sendCheckin(reminder, CHECKIN);

    expect(ok).toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    // Second (fallback) call sends without HTML parse mode.
    expect(sendMessage.mock.calls[1][2]).toMatchObject({ parse_mode: undefined });
  });
});
