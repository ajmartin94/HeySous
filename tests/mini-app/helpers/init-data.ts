import { sign } from "@tma.js/init-data-node";

/**
 * Minimal Telegram user shape accepted by `sign()`.
 *
 * `first_name` is REQUIRED here (unlike the real Telegram type, where it's
 * merely always-present-in-practice): `@tma.js/init-data-node`'s `parse()`
 * schema-validates the decoded user object and throws if `first_name` is
 * missing. The auth middleware calls `validate()` then `parse()` inside a
 * single try/catch that maps ANY thrown error to a generic 401 "Invalid
 * initData" -- so a user object missing `first_name` produces a
 * signature-valid-but-still-401 response that looks identical to a real
 * tampered/expired request. Keeping this field required here prevents that
 * foot-gun from silently poisoning tests.
 */
export interface TestTelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

/** Build a `TestTelegramUser` from just an id, e.g. for household/admin fixtures. */
export function testUser(id: number, firstName = "Test"): TestTelegramUser {
  return { id, first_name: firstName };
}

/**
 * Build a validly-signed Telegram initData string using the real
 * `@tma.js/init-data-node` `sign()` function -- the same library the
 * production auth middleware uses for `validate()`/`parse()`. This avoids
 * hand-rolling the HMAC scheme and guarantees byte-for-byte compatibility
 * with what the middleware expects.
 *
 * Pass no `user` at all (not even `undefined`) to build initData that
 * deliberately has no `user` field, e.g. for testing the middleware's
 * "No user in initData" branch.
 */
export function buildInitData(
  token: string,
  user?: TestTelegramUser,
  opts?: { authDate?: Date },
): string {
  return sign(
    {
      ...(user ? { user } : {}),
      chat_instance: "1",
      chat_type: "private",
    },
    token,
    opts?.authDate ?? new Date(),
  );
}

/** Corrupt the hash of a valid initData string so signature validation fails. */
export function tamperHash(initData: string): string {
  return initData.replace(/hash=([0-9a-f]+)/, (_m, hash: string) => {
    const flipped = hash[0] === "0" ? "1" : "0";
    return `hash=${flipped}${hash.slice(1)}`;
  });
}
