import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import {
  seedNotifications,
  checkPendingNotification,
} from "../../src/notifications/update-notifier.js";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Create notifications tables (post-migration-3 schema)
  sqlite.exec(`
    CREATE TABLE notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  sqlite.exec(`
    CREATE TABLE notification_deliveries (
      notification_id INTEGER NOT NULL REFERENCES notifications(id),
      user_id TEXT NOT NULL,
      delivered_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (notification_id, user_id)
    )
  `);

  // Create users table (needed for user creation time filtering)
  sqlite.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL DEFAULT '',
      household_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  return sqlite;
}

/** Insert a user row with a specific created_at timestamp */
function insertUser(
  sqlite: InstanceType<typeof Database>,
  telegramId: string,
  createdAt: number,
): void {
  sqlite
    .prepare(
      "INSERT INTO users (telegram_id, created_at) VALUES (?, ?)",
    )
    .run(telegramId, createdAt);
}

describe("update-notifier", () => {
  it("seeds release notes into notifications table", () => {
    const sqlite = createTestDb();
    insertUser(sqlite, "user-1", 0);
    seedNotifications(sqlite);

    const count = sqlite
      .prepare("SELECT COUNT(*) as cnt FROM notifications")
      .get() as { cnt: number };
    expect(count.cnt).toBeGreaterThan(0);

    sqlite.close();
  });

  it("seeding is idempotent", () => {
    const sqlite = createTestDb();
    insertUser(sqlite, "user-1", 0);
    seedNotifications(sqlite);
    seedNotifications(sqlite); // second call should not error or duplicate

    const count = sqlite
      .prepare("SELECT COUNT(*) as cnt FROM notifications")
      .get() as { cnt: number };
    // Should still be the same count (no duplicates)
    const versions = sqlite
      .prepare("SELECT version FROM notifications")
      .all() as Array<{ version: string }>;
    const uniqueVersions = new Set(versions.map((v) => v.version));
    expect(uniqueVersions.size).toBe(versions.length);

    sqlite.close();
  });

  it("returns pending notification for user", () => {
    const sqlite = createTestDb();
    insertUser(sqlite, "user-1", 0);
    seedNotifications(sqlite);

    const result = checkPendingNotification(sqlite, "user-1");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");

    sqlite.close();
  });

  it("returns null after all notifications have been delivered", () => {
    const sqlite = createTestDb();
    insertUser(sqlite, "user-1", 0);

    // Insert a single notification for deterministic behavior
    sqlite
      .prepare(
        "INSERT INTO notifications (version, content, created_at) VALUES (?, ?, ?)",
      )
      .run("1.0.0", "Test update", 1);

    // First call delivers the one notification
    const first = checkPendingNotification(sqlite, "user-1");
    expect(first).toBe("Test update");

    // Second call returns null (already delivered)
    const result = checkPendingNotification(sqlite, "user-1");
    expect(result).toBeNull();

    sqlite.close();
  });

  it("delivers independently to different users", () => {
    const sqlite = createTestDb();
    insertUser(sqlite, "user-1", 0);
    insertUser(sqlite, "user-2", 0);

    // Insert a single notification for deterministic behavior
    sqlite
      .prepare(
        "INSERT INTO notifications (version, content, created_at) VALUES (?, ?, ?)",
      )
      .run("1.0.0", "Shared update", 1);

    // Deliver to user 1
    const result1 = checkPendingNotification(sqlite, "user-1");
    expect(result1).toBe("Shared update");

    // User 2 still has pending
    const result2 = checkPendingNotification(sqlite, "user-2");
    expect(result2).toBe("Shared update");

    // User 1 has no more pending
    const result1Again = checkPendingNotification(sqlite, "user-1");
    expect(result1Again).toBeNull();

    sqlite.close();
  });

  it("returns null when no notifications exist", () => {
    const sqlite = createTestDb();
    insertUser(sqlite, "user-1", 0);
    // Do NOT seed

    const result = checkPendingNotification(sqlite, "user-1");
    expect(result).toBeNull();

    sqlite.close();
  });

  it("delivers multiple notifications one at a time in order", () => {
    const sqlite = createTestDb();
    insertUser(sqlite, "user-1", 0);

    // Insert two notifications manually
    sqlite
      .prepare("INSERT INTO notifications (version, content) VALUES (?, ?)")
      .run("1.0.0", "First update");
    sqlite
      .prepare("INSERT INTO notifications (version, content) VALUES (?, ?)")
      .run("1.1.0", "Second update");

    // First call returns first notification
    const first = checkPendingNotification(sqlite, "user-1");
    expect(first).toBe("First update");

    // Second call returns second notification
    const second = checkPendingNotification(sqlite, "user-1");
    expect(second).toBe("Second update");

    // Third call returns null (all delivered)
    const third = checkPendingNotification(sqlite, "user-1");
    expect(third).toBeNull();

    sqlite.close();
  });

  // --- New tests for user creation time filtering ---

  it("skips notifications created before user joined", () => {
    const sqlite = createTestDb();
    // User joined at time 1000
    insertUser(sqlite, "new-user", 1000);

    // Notification created at time 500 (before user joined)
    sqlite
      .prepare(
        "INSERT INTO notifications (version, content, created_at) VALUES (?, ?, ?)",
      )
      .run("old-release", "Old release notes", 500);

    const result = checkPendingNotification(sqlite, "new-user");
    expect(result).toBeNull();

    sqlite.close();
  });

  it("delivers notifications created after user joined", () => {
    const sqlite = createTestDb();
    // User joined at time 1000
    insertUser(sqlite, "new-user", 1000);

    // Notification created at time 1500 (after user joined)
    sqlite
      .prepare(
        "INSERT INTO notifications (version, content, created_at) VALUES (?, ?, ?)",
      )
      .run("new-release", "New release notes", 1500);

    const result = checkPendingNotification(sqlite, "new-user");
    expect(result).toBe("New release notes");

    sqlite.close();
  });

  it("existing user with old created_at still receives all undelivered notifications", () => {
    const sqlite = createTestDb();
    // Existing user with very old created_at
    insertUser(sqlite, "old-user", 0);

    // Insert notifications at various times
    sqlite
      .prepare(
        "INSERT INTO notifications (version, content, created_at) VALUES (?, ?, ?)",
      )
      .run("v1.4", "V1.4 notes", 100);
    sqlite
      .prepare(
        "INSERT INTO notifications (version, content, created_at) VALUES (?, ?, ?)",
      )
      .run("v1.5", "V1.5 notes", 200);

    // Old user should see all notifications
    const first = checkPendingNotification(sqlite, "old-user");
    expect(first).toBe("V1.4 notes");

    const second = checkPendingNotification(sqlite, "old-user");
    expect(second).toBe("V1.5 notes");

    sqlite.close();
  });

  it("excludes notification created at exact same second as user joined (strict >)", () => {
    const sqlite = createTestDb();
    // User joined at time 1000
    insertUser(sqlite, "edge-user", 1000);

    // Notification created at exact same time 1000
    sqlite
      .prepare(
        "INSERT INTO notifications (version, content, created_at) VALUES (?, ?, ?)",
      )
      .run("same-second", "Same second release", 1000);

    // Should NOT be delivered (strict > not >=)
    const result = checkPendingNotification(sqlite, "edge-user");
    expect(result).toBeNull();

    sqlite.close();
  });

  it("returns notification when user has no row in users table (COALESCE fallback)", () => {
    const sqlite = createTestDb();
    // Do NOT insert user row

    // Insert a notification with created_at > 0
    sqlite
      .prepare(
        "INSERT INTO notifications (version, content, created_at) VALUES (?, ?, ?)",
      )
      .run("v1.0", "Some notes", 100);

    // No user row -> COALESCE to 0 -> notification eligible (safe default)
    const result = checkPendingNotification(sqlite, "ghost-user");
    expect(result).toBe("Some notes");

    sqlite.close();
  });
});
