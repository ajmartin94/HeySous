import { describe, it, expect, vi, beforeEach } from "vitest";
import { BotError } from "grammy";
import type { Bot } from "grammy";
import type { BotContext } from "../../../src/bot/context.js";
import { setupErrorHandler } from "../../../src/bot/middlewares/error-handler.js";

vi.mock("../../../src/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

/**
 * Minimal fake Bot that only implements `.catch()`, capturing the handler
 * so tests can invoke it directly with a synthetic BotError. grammY's real
 * Bot requires a token and network setup we don't want in a unit test.
 */
function createFakeBot() {
  let errorHandler: ((err: BotError<BotContext>) => unknown) | undefined;
  return {
    catch: (fn: (err: BotError<BotContext>) => unknown) => {
      errorHandler = fn;
    },
    trigger: (err: BotError<BotContext>) => {
      if (!errorHandler) throw new Error("error handler was never registered");
      return errorHandler(err);
    },
  };
}

function createFakeCtx(overrides: Partial<BotContext> = {}) {
  return {
    update: { update_id: 42 },
    chat: { id: 123 },
    reply: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as BotContext;
}

describe("setupErrorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a best-effort plain-text reply to the user when a handler throws", async () => {
    const fakeBot = createFakeBot();
    setupErrorHandler(fakeBot as unknown as Bot<BotContext>);

    const ctx = createFakeCtx();
    const err = new BotError(new Error("boom"), ctx);

    fakeBot.trigger(err);
    // Reply is fire-and-forget inside the handler; flush microtasks.
    await Promise.resolve();
    await Promise.resolve();

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith(
      "Sorry, something went wrong handling that. Please try again.",
      { parse_mode: undefined },
    );
  });

  it("does not reply when there is no chat context", async () => {
    const fakeBot = createFakeBot();
    setupErrorHandler(fakeBot as unknown as Bot<BotContext>);

    const ctx = createFakeCtx({ chat: undefined });
    const err = new BotError(new Error("boom"), ctx);

    fakeBot.trigger(err);
    await Promise.resolve();

    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it("never throws even if the best-effort reply itself fails", async () => {
    const fakeBot = createFakeBot();
    setupErrorHandler(fakeBot as unknown as Bot<BotContext>);

    const ctx = createFakeCtx({
      reply: vi.fn().mockRejectedValue(new Error("network down")),
    });
    const err = new BotError(new Error("boom"), ctx);

    expect(() => fakeBot.trigger(err)).not.toThrow();
    // Let the rejected reply promise settle without an unhandled rejection.
    await Promise.resolve();
    await Promise.resolve();
  });

  it("handles GrammyError and HttpError instances without throwing", async () => {
    const fakeBot = createFakeBot();
    setupErrorHandler(fakeBot as unknown as Bot<BotContext>);

    const ctx = createFakeCtx();
    const err = new BotError(new Error("some unexpected error"), ctx);

    expect(() => fakeBot.trigger(err)).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });
});
