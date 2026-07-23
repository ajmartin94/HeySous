import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { createReminderPoller } from "../../src/reminders/poller.js";
import { createReminderRepository } from "../../src/reminders/repository.js";
import { createTestClock } from "../../src/clock.js";
import type { Reminder } from "../../src/reminders/types.js";
import type { FeedbackCheckin } from "../../src/feedback/types.js";

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

function makeReminder(id: number, type: Reminder["type"] = "start_cooking"): Reminder {
  return {
    id,
    householdId: "h1",
    type,
    dueAt: new Date(),
    status: "pending",
    contextJson: "{}",
    generatedText: null,
    sentAt: null,
    createdAt: new Date(),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("reminder poller -- overlapping tick guard", () => {
  it("skips a new tick while the previous tick is still running", async () => {
    // Two due reminders; the first send blocks so the tick stays mid-flight.
    const block = deferred<boolean>();
    const getDueReminders = vi.fn(() => [makeReminder(1), makeReminder(2)]);
    const reminderRepository = {
      getDueReminders,
      markSent: vi.fn(),
      markFailed: vi.fn(),
    };
    let sendCount = 0;
    const sendReminder = vi.fn(() => {
      sendCount += 1;
      return sendCount === 1 ? block.promise : Promise.resolve(true);
    });
    const poller = createReminderPoller({
      reminderRepository,
      sender: { sendReminder },
      logger: makeLogger(),
    });

    const first = poller.tick(); // starts, blocks awaiting the first send
    await Promise.resolve(); // let the first tick reach its await

    // A second tick fires while the first is still running -- it must be skipped
    // and must NOT re-query due reminders (which would double-dispatch).
    await poller.tick();
    expect(getDueReminders).toHaveBeenCalledTimes(1);

    // Unblock the first tick and let it drain.
    block.resolve(true);
    await first;

    // Once the guard is released a subsequent tick runs normally.
    await poller.tick();
    expect(getDueReminders).toHaveBeenCalledTimes(2);
  });
});

describe("reminder poller -- feedback check-in transition", () => {
  it("marks the tracking check-in sent after a successful delivery", async () => {
    const reminder = makeReminder(7, "feedback_checkin");
    const checkin: FeedbackCheckin = {
      id: 42,
      householdId: "h1",
      reminderId: 7,
      mealsJson: "[]",
      status: "pending",
      sentiment: null,
      notes: null,
      respondedAt: null,
      createdAt: new Date(),
    };
    const reminderRepository = {
      getDueReminders: vi.fn(() => [reminder]),
      markSent: vi.fn(),
      markFailed: vi.fn(),
    };
    const markCheckinSent = vi.fn();
    const feedbackRepository = {
      getCheckinByReminderId: vi.fn(() => checkin),
      markCheckinSent,
    };
    const feedbackSender = { sendCheckin: vi.fn(() => Promise.resolve(true)) };

    const poller = createReminderPoller({
      reminderRepository,
      sender: { sendReminder: vi.fn() },
      logger: makeLogger(),
      feedbackSender,
      feedbackRepository,
    });

    await poller.tick();

    expect(feedbackSender.sendCheckin).toHaveBeenCalledOnce();
    expect(markCheckinSent).toHaveBeenCalledWith(42);
    expect(reminderRepository.markSent).toHaveBeenCalledWith(7, "");
  });

  it("does NOT mark the check-in sent when delivery fails", async () => {
    const reminder = makeReminder(8, "feedback_checkin");
    const checkin: FeedbackCheckin = {
      id: 43,
      householdId: "h1",
      reminderId: 8,
      mealsJson: "[]",
      status: "pending",
      sentiment: null,
      notes: null,
      respondedAt: null,
      createdAt: new Date(),
    };
    const reminderRepository = {
      getDueReminders: vi.fn(() => [reminder]),
      markSent: vi.fn(),
      markFailed: vi.fn(),
    };
    const markCheckinSent = vi.fn();
    const feedbackRepository = {
      getCheckinByReminderId: vi.fn(() => checkin),
      markCheckinSent,
    };
    const feedbackSender = { sendCheckin: vi.fn(() => Promise.resolve(false)) };

    const poller = createReminderPoller({
      reminderRepository,
      sender: { sendReminder: vi.fn() },
      logger: makeLogger(),
      feedbackSender,
      feedbackRepository,
    });

    await poller.tick();

    expect(markCheckinSent).not.toHaveBeenCalled();
    expect(reminderRepository.markFailed).toHaveBeenCalledWith(8);
  });
});

describe("reminder poller -- interval scheduling (fake timers + Clock)", () => {
  let sqlite: InstanceType<typeof Database>;

  beforeEach(() => {
    vi.useFakeTimers();
    sqlite = new Database(":memory:");
    sqlite.exec(`
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
    sqlite.exec(`CREATE TABLE application_settings (household_id TEXT, muted_until INTEGER)`);
  });

  afterEach(() => {
    sqlite.close();
    vi.useRealTimers();
  });

  it("processes each due reminder once across successive interval ticks", async () => {
    const clock = createTestClock(new Date("2026-02-23T06:00:00Z"));
    const reminderRepository = createReminderRepository(sqlite, clock);
    reminderRepository.createReminder({
      householdId: "h1",
      type: "start_cooking",
      dueAt: new Date(clock.now() - 60_000), // already due
      contextJson: "{}",
    });

    const sendReminder = vi.fn(() => Promise.resolve(true));
    const poller = createReminderPoller({
      reminderRepository,
      sender: { sendReminder },
      logger: makeLogger(),
    });

    poller.start(); // immediate tick
    await vi.advanceTimersByTimeAsync(0);
    expect(sendReminder).toHaveBeenCalledTimes(1);

    // The interval fires again 60s later; the reminder is already marked sent,
    // so it is not re-dispatched.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sendReminder).toHaveBeenCalledTimes(1);

    poller.stop();
  });
});
