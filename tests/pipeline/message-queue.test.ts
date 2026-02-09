import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MessageQueue, createMessageQueue } from "../../src/pipeline/message-queue.js";
import type { PendingBatch } from "../../src/pipeline/message-queue.js";

describe("MessageQueue", () => {
  let queue: MessageQueue;
  let processFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    queue = new MessageQueue(1500);
    processFn = vi.fn<(batch: PendingBatch) => Promise<void>>().mockResolvedValue(undefined);
  });

  afterEach(() => {
    queue.shutdown();
    vi.useRealTimers();
  });

  describe("single message batch", () => {
    it("calls processFn with a single-message batch after debounce window expires", () => {
      queue.enqueue("chat-1", "user-1", "hello", { fake: "ctx" }, processFn);

      // Before window expires, processFn should NOT be called
      vi.advanceTimersByTime(1499);
      expect(processFn).not.toHaveBeenCalled();

      // After window expires, processFn should be called once
      vi.advanceTimersByTime(1);
      expect(processFn).toHaveBeenCalledOnce();

      const batch = processFn.mock.calls[0][0] as PendingBatch;
      expect(batch.chatId).toBe("chat-1");
      expect(batch.userId).toBe("user-1");
      expect(batch.messages).toHaveLength(1);
      expect(batch.messages[0].text).toBe("hello");
      expect(batch.messages[0].timestamp).toBeInstanceOf(Date);
      expect(batch.ctx).toEqual({ fake: "ctx" });
    });
  });

  describe("multi-message batch", () => {
    it("batches two messages sent within the debounce window", () => {
      queue.enqueue("chat-1", "user-1", "first", { ctx: 1 }, processFn);

      vi.advanceTimersByTime(500);
      queue.enqueue("chat-1", "user-1", "second", { ctx: 2 }, processFn);

      // 500ms after second message, total 1000ms -- still within window
      vi.advanceTimersByTime(500);
      expect(processFn).not.toHaveBeenCalled();

      // 1500ms after second message -- window expires
      vi.advanceTimersByTime(1000);
      expect(processFn).toHaveBeenCalledOnce();

      const batch = processFn.mock.calls[0][0] as PendingBatch;
      expect(batch.messages).toHaveLength(2);
      expect(batch.messages[0].text).toBe("first");
      expect(batch.messages[1].text).toBe("second");
    });

    it("batches three messages sent within the debounce window", () => {
      queue.enqueue("chat-1", "user-1", "one", { ctx: 1 }, processFn);

      vi.advanceTimersByTime(400);
      queue.enqueue("chat-1", "user-1", "two", { ctx: 2 }, processFn);

      vi.advanceTimersByTime(400);
      queue.enqueue("chat-1", "user-1", "three", { ctx: 3 }, processFn);

      // Not yet expired (only 400ms since last message)
      vi.advanceTimersByTime(400);
      expect(processFn).not.toHaveBeenCalled();

      // Now 1500ms after last message
      vi.advanceTimersByTime(1100);
      expect(processFn).toHaveBeenCalledOnce();

      const batch = processFn.mock.calls[0][0] as PendingBatch;
      expect(batch.messages).toHaveLength(3);
      expect(batch.messages[0].text).toBe("one");
      expect(batch.messages[1].text).toBe("two");
      expect(batch.messages[2].text).toBe("three");
    });
  });

  describe("sliding window reset", () => {
    it("resets the debounce timer on each new message", () => {
      queue.enqueue("chat-1", "user-1", "first", { ctx: 1 }, processFn);

      // Advance to just before window expires (1400ms)
      vi.advanceTimersByTime(1400);
      expect(processFn).not.toHaveBeenCalled();

      // Add second message -- resets the window
      queue.enqueue("chat-1", "user-1", "second", { ctx: 2 }, processFn);

      // The original 1500ms from first message would have fired by now
      vi.advanceTimersByTime(200);
      expect(processFn).not.toHaveBeenCalled();

      // 1500ms after second message
      vi.advanceTimersByTime(1300);
      expect(processFn).toHaveBeenCalledOnce();

      const batch = processFn.mock.calls[0][0] as PendingBatch;
      expect(batch.messages).toHaveLength(2);
    });
  });

  describe("independent chat batches", () => {
    it("processes messages from different chatIds independently", () => {
      queue.enqueue("chat-A", "user-1", "hello A", { ctx: "A" }, processFn);
      queue.enqueue("chat-B", "user-2", "hello B", { ctx: "B" }, processFn);

      vi.advanceTimersByTime(1500);

      expect(processFn).toHaveBeenCalledTimes(2);

      const batchA = processFn.mock.calls.find(
        (call) => (call[0] as PendingBatch).chatId === "chat-A"
      )![0] as PendingBatch;
      const batchB = processFn.mock.calls.find(
        (call) => (call[0] as PendingBatch).chatId === "chat-B"
      )![0] as PendingBatch;

      expect(batchA.messages[0].text).toBe("hello A");
      expect(batchA.userId).toBe("user-1");
      expect(batchB.messages[0].text).toBe("hello B");
      expect(batchB.userId).toBe("user-2");
    });

    it("batches messages per chatId without interference", () => {
      queue.enqueue("chat-A", "user-1", "A1", { ctx: "A1" }, processFn);

      vi.advanceTimersByTime(500);
      queue.enqueue("chat-B", "user-2", "B1", { ctx: "B1" }, processFn);

      vi.advanceTimersByTime(500);
      queue.enqueue("chat-A", "user-1", "A2", { ctx: "A2" }, processFn);

      // 1500ms after chat-B's message -- chat-B fires
      vi.advanceTimersByTime(1000);
      expect(processFn).toHaveBeenCalledTimes(1);
      expect((processFn.mock.calls[0][0] as PendingBatch).chatId).toBe("chat-B");

      // 1500ms after chat-A's second message -- chat-A fires
      vi.advanceTimersByTime(500);
      expect(processFn).toHaveBeenCalledTimes(2);

      const batchA = processFn.mock.calls.find(
        (call) => (call[0] as PendingBatch).chatId === "chat-A"
      )![0] as PendingBatch;
      expect(batchA.messages).toHaveLength(2);
      expect(batchA.messages[0].text).toBe("A1");
      expect(batchA.messages[1].text).toBe("A2");
    });
  });

  describe("batch deleted before processFn (anti-double-processing)", () => {
    it("deletes batch from map before calling processFn", () => {
      processFn.mockImplementation(async () => {
        // During processing, pendingCount should be 0
        // because the batch was deleted before processFn was called
        expect(queue.pendingCount).toBe(0);
      });

      queue.enqueue("chat-1", "user-1", "test", { ctx: 1 }, processFn);
      expect(queue.pendingCount).toBe(1);

      vi.advanceTimersByTime(1500);
      expect(processFn).toHaveBeenCalledOnce();
    });

    it("allows new messages during processing to start a fresh batch", () => {
      let resolveProcessing: () => void;
      const processingPromise = new Promise<void>((resolve) => {
        resolveProcessing = resolve;
      });

      const slowProcessFn = vi.fn<(batch: PendingBatch) => Promise<void>>().mockImplementation(async () => {
        // Simulate slow processing
        await processingPromise;
      });

      queue.enqueue("chat-1", "user-1", "batch1", { ctx: 1 }, slowProcessFn);

      // Fire the first batch
      vi.advanceTimersByTime(1500);
      expect(slowProcessFn).toHaveBeenCalledOnce();

      // New message arrives during processing -- should start fresh batch
      queue.enqueue("chat-1", "user-1", "batch2", { ctx: 2 }, slowProcessFn);
      expect(queue.pendingCount).toBe(1);

      // Fire the second batch
      vi.advanceTimersByTime(1500);
      expect(slowProcessFn).toHaveBeenCalledTimes(2);

      const firstBatch = slowProcessFn.mock.calls[0][0] as PendingBatch;
      const secondBatch = slowProcessFn.mock.calls[1][0] as PendingBatch;

      expect(firstBatch.messages).toHaveLength(1);
      expect(firstBatch.messages[0].text).toBe("batch1");
      expect(secondBatch.messages).toHaveLength(1);
      expect(secondBatch.messages[0].text).toBe("batch2");

      // Clean up
      resolveProcessing!();
    });
  });

  describe("latest context reference", () => {
    it("uses the latest ctx from the most recent message in the batch", () => {
      queue.enqueue("chat-1", "user-1", "first", { old: "ctx" }, processFn);

      vi.advanceTimersByTime(500);
      queue.enqueue("chat-1", "user-1", "second", { new: "ctx" }, processFn);

      vi.advanceTimersByTime(1500);

      const batch = processFn.mock.calls[0][0] as PendingBatch;
      expect(batch.ctx).toEqual({ new: "ctx" });
    });
  });

  describe("pendingCount", () => {
    it("returns 0 when no messages are pending", () => {
      expect(queue.pendingCount).toBe(0);
    });

    it("returns correct count of pending batches", () => {
      queue.enqueue("chat-1", "user-1", "msg", {}, processFn);
      expect(queue.pendingCount).toBe(1);

      queue.enqueue("chat-2", "user-2", "msg", {}, processFn);
      expect(queue.pendingCount).toBe(2);

      // Adding to existing batch doesn't increase count
      queue.enqueue("chat-1", "user-1", "msg2", {}, processFn);
      expect(queue.pendingCount).toBe(2);
    });

    it("decreases after batch is processed", () => {
      queue.enqueue("chat-1", "user-1", "msg", {}, processFn);
      expect(queue.pendingCount).toBe(1);

      vi.advanceTimersByTime(1500);
      expect(queue.pendingCount).toBe(0);
    });
  });

  describe("shutdown", () => {
    it("clears all pending timers and empties the map", () => {
      queue.enqueue("chat-1", "user-1", "msg1", {}, processFn);
      queue.enqueue("chat-2", "user-2", "msg2", {}, processFn);
      expect(queue.pendingCount).toBe(2);

      queue.shutdown();
      expect(queue.pendingCount).toBe(0);

      // Advancing time should NOT trigger processFn
      vi.advanceTimersByTime(5000);
      expect(processFn).not.toHaveBeenCalled();
    });
  });

  describe("configurable debounce window", () => {
    it("uses custom debounce window", () => {
      const shortQueue = new MessageQueue(500);
      shortQueue.enqueue("chat-1", "user-1", "fast", {}, processFn);

      vi.advanceTimersByTime(499);
      expect(processFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(processFn).toHaveBeenCalledOnce();

      shortQueue.shutdown();
    });

    it("defaults to 1500ms when no debounce specified", () => {
      const defaultQueue = new MessageQueue();
      defaultQueue.enqueue("chat-1", "user-1", "default", {}, processFn);

      vi.advanceTimersByTime(1499);
      expect(processFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(processFn).toHaveBeenCalledOnce();

      defaultQueue.shutdown();
    });
  });

  describe("error handling", () => {
    it("does not crash when processFn throws", () => {
      const errorProcessFn = vi.fn<(batch: PendingBatch) => Promise<void>>().mockRejectedValue(
        new Error("processing failed")
      );

      queue.enqueue("chat-1", "user-1", "msg", {}, errorProcessFn);

      // Should not throw
      expect(() => vi.advanceTimersByTime(1500)).not.toThrow();
      expect(errorProcessFn).toHaveBeenCalledOnce();
    });
  });

  describe("createMessageQueue factory", () => {
    it("creates a MessageQueue instance", () => {
      const q = createMessageQueue(1000);
      expect(q).toBeInstanceOf(MessageQueue);
      q.shutdown();
    });

    it("creates a MessageQueue with default debounce", () => {
      const q = createMessageQueue();
      expect(q).toBeInstanceOf(MessageQueue);
      q.shutdown();
    });
  });
});
