import { describe, it, expect, vi } from "vitest";
import {
  isParseEntitiesError,
  sendWithHtmlFallback,
} from "../../src/reminders/sender.js";

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

/** Shape of a Telegram "can't parse entities" rejection. */
const parseEntitiesError = {
  error_code: 400,
  description: "Bad Request: can't parse entities: Unsupported start tag \"3\"",
};

describe("isParseEntitiesError", () => {
  it("detects a Telegram parse-entities rejection by description", () => {
    expect(isParseEntitiesError(parseEntitiesError)).toBe(true);
  });

  it("returns false for a 403 blocked-user error", () => {
    expect(isParseEntitiesError({ error_code: 403, description: "Forbidden: bot was blocked" })).toBe(false);
  });

  it("returns false for non-error values", () => {
    expect(isParseEntitiesError(null)).toBe(false);
    expect(isParseEntitiesError(new Error("boom"))).toBe(false);
  });
});

describe("sendWithHtmlFallback", () => {
  it("sends as HTML on the happy path", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    await sendWithHtmlFallback({ sendMessage }, "chat1", "hello", {}, makeLogger(), {});

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith("chat1", "hello", { parse_mode: "HTML" });
  });

  it("retries as plain text when HTML entity parsing fails", async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(parseEntitiesError)
      .mockResolvedValueOnce(undefined);
    const logger = makeLogger();

    await sendWithHtmlFallback(
      { sendMessage },
      "chat1",
      "Beef <3 Rice",
      { reply_markup: { foo: 1 } },
      logger,
      { reminderId: 1 },
    );

    expect(sendMessage).toHaveBeenCalledTimes(2);
    // First attempt: HTML. Second attempt: plain text, keyboard preserved.
    expect(sendMessage).toHaveBeenNthCalledWith(1, "chat1", "Beef <3 Rice", {
      parse_mode: "HTML",
      reply_markup: { foo: 1 },
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, "chat1", "Beef <3 Rice", {
      reply_markup: { foo: 1 },
      parse_mode: undefined,
    });
    expect(logger.warn).toHaveBeenCalled();
  });

  it("rethrows non-parse errors (e.g. blocked user) without retrying", async () => {
    const blocked = { error_code: 403, description: "Forbidden: bot was blocked by the user" };
    const sendMessage = vi.fn().mockRejectedValue(blocked);

    await expect(
      sendWithHtmlFallback({ sendMessage }, "chat1", "hi", {}, makeLogger(), {}),
    ).rejects.toBe(blocked);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});
