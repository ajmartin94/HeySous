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

  return sqlite;
}

describe("update-notifier", () => {
  it("seeds release notes into notifications table", () => {
    const sqlite = createTestDb();
    seedNotifications(sqlite);

    const count = sqlite
      .prepare("SELECT COUNT(*) as cnt FROM notifications")
      .get() as { cnt: number };
    expect(count.cnt).toBeGreaterThan(0);

    sqlite.close();
  });

  it("seeding is idempotent", () => {
    const sqlite = createTestDb();
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
    seedNotifications(sqlite);

    const result = checkPendingNotification(sqlite, "user-1");
    expect(result).toBeTruthy();
    expect(result).toContain("new tricks");

    sqlite.close();
  });

  it("returns null after notification has been delivered", () => {
    const sqlite = createTestDb();
    seedNotifications(sqlite);

    // First call delivers
    checkPendingNotification(sqlite, "user-1");

    // Second call returns null (already delivered)
    const result = checkPendingNotification(sqlite, "user-1");
    expect(result).toBeNull();

    sqlite.close();
  });

  it("delivers independently to different users", () => {
    const sqlite = createTestDb();
    seedNotifications(sqlite);

    // Deliver to user 1
    const result1 = checkPendingNotification(sqlite, "user-1");
    expect(result1).toBeTruthy();

    // User 2 still has pending
    const result2 = checkPendingNotification(sqlite, "user-2");
    expect(result2).toBeTruthy();

    // User 1 has no more pending
    const result1Again = checkPendingNotification(sqlite, "user-1");
    expect(result1Again).toBeNull();

    sqlite.close();
  });

  it("returns null when no notifications exist", () => {
    const sqlite = createTestDb();
    // Do NOT seed

    const result = checkPendingNotification(sqlite, "user-1");
    expect(result).toBeNull();

    sqlite.close();
  });

  it("delivers multiple notifications one at a time in order", () => {
    const sqlite = createTestDb();

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
});
