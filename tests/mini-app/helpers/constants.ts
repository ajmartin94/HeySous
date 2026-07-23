/**
 * Shared constants for mini-app route/middleware tests.
 *
 * IMPORTANT: These string values must be duplicated literally inside each
 * test file's `vi.mock("../../src/config.js", ...)` factory (vi.mock
 * factories are hoisted above imports and cannot reference variables from
 * this module). Keep this file and every `vi.mock` block in sync.
 */

/** Fake bot token used to sign/validate initData in tests. Never a real secret. */
export const TEST_BOT_TOKEN = "123456:TEST-BOT-TOKEN-abcdefghijklmnop";

/** Telegram user id seeded as the admin user by `initializeUsers`. */
export const TEST_ADMIN_ID = "999";
