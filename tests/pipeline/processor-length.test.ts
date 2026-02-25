import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProcessor } from "../../src/pipeline/processor.js";
import type { PendingBatch } from "../../src/pipeline/message-queue.js";

/**
 * Tests for the message length validation in the pipeline processor.
 *
 * The processor rejects combined debounced messages exceeding 4,000 characters
 * before they reach the AI pipeline or get stored in conversation history.
 */

// Minimal mock context that satisfies BotContext usage in the length check path
function createMockCtx() {
  return {
    reply: vi.fn().mockResolvedValue(undefined),
    replyWithChatAction: vi.fn().mockResolvedValue(undefined),
    householdId: "household-1",
    user: { telegramId: "user-1", displayName: "Test", onboardingState: "complete" },
    chat: { id: 123 },
    from: { id: 123 },
    api: {},
  };
}

// Minimal mock dependencies for createProcessor
function createMockDeps() {
  const insertRun = vi.fn();
  const insertValues = vi.fn().mockReturnValue({ run: insertRun });
  const mockDb = {
    insert: vi.fn().mockReturnValue({ values: insertValues }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            all: vi.fn().mockReturnValue([]),
          }),
        }),
      }),
    }),
  };

  const mockClaudeClient = {
    sendMessage: vi.fn(),
    sendMessageWithTools: vi.fn().mockResolvedValue({
      text: "Hello!",
      model: "claude-sonnet-4-20250514",
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      },
    }),
  };

  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };

  return {
    claudeClient: mockClaudeClient as any,
    db: mockDb as any,
    logger: mockLogger as any,
    retrievalService: {} as any,
    knowledgeRepository: {} as any,
    planRepository: {
      getActivePlans: vi.fn().mockReturnValue([]),
    } as any,
    sqlite: {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue([]),
        get: vi.fn().mockReturnValue(undefined),
        run: vi.fn(),
      }),
    } as any,
    clock: { now: () => Date.now() } as any,
    reminderRepository: {
      getOrCreateSettings: vi.fn().mockReturnValue({ timezone: "America/New_York" }),
    } as any,
    // Expose mocks for assertions
    _insertRun: insertRun,
  };
}

function createBatch(textOrTexts: string | string[], ctx: any): PendingBatch {
  const texts = Array.isArray(textOrTexts) ? textOrTexts : [textOrTexts];
  return {
    chatId: "chat-1",
    userId: "user-1",
    messages: texts.map((text) => ({
      text,
      timestamp: new Date(),
    })),
    ctx,
  };
}

describe("processor message length validation", () => {
  let deps: ReturnType<typeof createMockDeps>;
  let processBatch: (batch: PendingBatch) => Promise<void>;
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    deps = createMockDeps();
    processBatch = createProcessor(deps);
    ctx = createMockCtx();
  });

  it("rejects messages exceeding 4,000 characters with in-character response", async () => {
    const longText = "x".repeat(4_001);
    const batch = createBatch(longText, ctx);

    await processBatch(batch);

    // Should reply with rejection message mentioning 4,000
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const replyArg = ctx.reply.mock.calls[0][0] as string;
    expect(replyArg).toContain("4,000");

    // Should NOT save to database (db.insert should not be called for messages table)
    expect(deps._insertRun).not.toHaveBeenCalled();

    // Should NOT call Claude API
    expect(deps.claudeClient.sendMessageWithTools).not.toHaveBeenCalled();
  });

  it("allows messages at exactly 4,000 characters to pass through", async () => {
    const exactText = "x".repeat(4_000);
    const batch = createBatch(exactText, ctx);

    await processBatch(batch);

    // Should NOT get a rejection reply containing "4,000"
    // (it may get other replies from later processing stages)
    const rejectionCalls = ctx.reply.mock.calls.filter(
      (call: any[]) => typeof call[0] === "string" && call[0].includes("4,000"),
    );
    expect(rejectionCalls).toHaveLength(0);

    // Should attempt to save to database (processing continues)
    expect(deps._insertRun).toHaveBeenCalled();
  });

  it("rejects when multiple messages combine to exceed limit", async () => {
    // 3 messages of 1,500 chars each, joined with "\n\n" = 1500 + 2 + 1500 + 2 + 1500 = 4504
    const texts = ["a".repeat(1_500), "b".repeat(1_500), "c".repeat(1_500)];
    const batch = createBatch(texts, ctx);

    await processBatch(batch);

    // Should reply with rejection message
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const replyArg = ctx.reply.mock.calls[0][0] as string;
    expect(replyArg).toContain("4,000");

    // Should NOT call Claude API
    expect(deps.claudeClient.sendMessageWithTools).not.toHaveBeenCalled();

    // Should NOT save to database
    expect(deps._insertRun).not.toHaveBeenCalled();
  });

  it("allows short messages to pass through normally", async () => {
    const batch = createBatch("hello", ctx);

    await processBatch(batch);

    // Should NOT get a rejection reply mentioning "4,000"
    const rejectionCalls = ctx.reply.mock.calls.filter(
      (call: any[]) => typeof call[0] === "string" && call[0].includes("4,000"),
    );
    expect(rejectionCalls).toHaveLength(0);

    // Should save to database (processing continues past length check)
    expect(deps._insertRun).toHaveBeenCalled();
  });

  it("logs rejection with message length details", async () => {
    const longText = "x".repeat(5_000);
    const batch = createBatch(longText, ctx);

    await processBatch(batch);

    expect(deps.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "chat-1",
        userId: "user-1",
        messageLength: 5_000,
        limit: 4_000,
      }),
      "Message rejected: exceeds length limit",
    );
  });
});
