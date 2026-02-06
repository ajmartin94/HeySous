/**
 * Message Debounce Queue
 *
 * Batches rapid consecutive Telegram messages into a single processing unit.
 * Uses a sliding debounce window per chatId -- each new message resets the timer.
 * After the window expires, the batch is delivered to a processor callback.
 *
 * Key design decisions:
 * - Batch is deleted from internal map BEFORE processFn fires (anti-double-processing)
 * - processFn errors are caught and logged, never crash the queue
 * - Queue is context-type-agnostic (ctx is `unknown`)
 */

export interface PendingBatch {
  chatId: string;
  userId: string;
  messages: Array<{ text: string; timestamp: Date }>;
  ctx: unknown;
}

export type ProcessFn = (batch: PendingBatch) => Promise<void>;

interface InternalEntry extends PendingBatch {
  timer: ReturnType<typeof setTimeout>;
}

export class MessageQueue {
  private readonly debounceMs: number;
  private readonly pending: Map<string, InternalEntry> = new Map();

  constructor(debounceMs: number = 1500) {
    this.debounceMs = debounceMs;
  }

  enqueue(
    chatId: string,
    userId: string,
    text: string,
    ctx: unknown,
    processFn: ProcessFn,
  ): void {
    const existing = this.pending.get(chatId);

    if (existing) {
      clearTimeout(existing.timer);
      existing.messages.push({ text, timestamp: new Date() });
      existing.ctx = ctx;
    } else {
      this.pending.set(chatId, {
        chatId,
        userId,
        messages: [{ text, timestamp: new Date() }],
        ctx,
        timer: undefined as unknown as ReturnType<typeof setTimeout>,
      });
    }

    const entry = this.pending.get(chatId)!;
    entry.timer = setTimeout(() => {
      // Delete BEFORE calling processFn to prevent double-processing.
      // New messages arriving during processing will start a fresh batch.
      this.pending.delete(chatId);

      const batch: PendingBatch = {
        chatId: entry.chatId,
        userId: entry.userId,
        messages: entry.messages,
        ctx: entry.ctx,
      };

      processFn(batch).catch(() => {
        // Queue must not crash on processor errors.
        // Logging will be added by the caller (pipeline processor).
      });
    }, this.debounceMs);
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  shutdown(): void {
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
    }
    this.pending.clear();
  }
}

export function createMessageQueue(debounceMs?: number): MessageQueue {
  return new MessageQueue(debounceMs);
}
