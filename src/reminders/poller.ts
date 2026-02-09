import type { Logger } from "pino";
import type { Reminder } from "./types.js";

/**
 * Minimal interface for the reminder repository -- only methods the poller needs.
 */
interface ReminderRepository {
  getDueReminders: () => Reminder[];
  markSent: (id: number, generatedText: string) => void;
  markFailed: (id: number) => void;
}

/**
 * Minimal interface for the sender -- only the sendReminder method.
 */
interface ReminderSender {
  sendReminder: (reminder: Reminder) => Promise<boolean>;
}

export interface ReminderPollerDeps {
  reminderRepository: ReminderRepository;
  sender: ReminderSender;
  logger: Logger;
}

/** Polling interval: 60 seconds. */
const POLL_INTERVAL_MS = 60_000;

/**
 * Factory function for the reminder poller.
 *
 * The poller runs on a 60-second setInterval, querying for due reminders
 * and dispatching them sequentially via the sender.
 *
 * Key behaviors:
 * - Mark sent BEFORE delivery attempt (prevents duplicates on crash/restart)
 * - Process overdue reminders on startup (immediate tick)
 * - Sequential processing to avoid Telegram rate limits
 * - NEVER crashes -- all errors caught and logged
 */
export function createReminderPoller(deps: ReminderPollerDeps) {
  const { reminderRepository, sender, logger } = deps;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  /**
   * Single poll cycle: query due reminders and dispatch them sequentially.
   */
  async function tick(): Promise<void> {
    try {
      const dueReminders = reminderRepository.getDueReminders();

      if (dueReminders.length === 0) {
        return;
      }

      logger.info(
        { count: dueReminders.length },
        "Processing due reminders",
      );

      // Process sequentially to avoid Telegram rate limits
      for (const reminder of dueReminders) {
        try {
          // Mark sent BEFORE delivery -- prevents duplicates if process crashes mid-send
          reminderRepository.markSent(reminder.id, "");

          const success = await sender.sendReminder(reminder);

          if (success) {
            logger.info(
              { reminderId: reminder.id, chatId: reminder.chatId, type: reminder.type },
              "Reminder delivered",
            );
          } else {
            // Delivery failed -- override status to failed
            reminderRepository.markFailed(reminder.id);
            logger.info(
              { reminderId: reminder.id, chatId: reminder.chatId, type: reminder.type },
              "Reminder delivery failed, marked as failed",
            );
          }
        } catch (error) {
          // Individual reminder processing error -- mark failed and continue
          try {
            reminderRepository.markFailed(reminder.id);
          } catch (markError) {
            logger.error(
              { reminderId: reminder.id, error: markError },
              "Failed to mark reminder as failed",
            );
          }
          logger.error(
            { reminderId: reminder.id, error },
            "Error processing reminder",
          );
        }
      }
    } catch (error) {
      // Outer catch -- protects the entire tick from crashing
      logger.error({ error }, "Error in reminder poller tick");
    }
  }

  return {
    /**
     * Start the poller.
     * Immediately processes any overdue reminders, then polls every 60 seconds.
     */
    start(): void {
      logger.info("Reminder poller started (60s interval)");

      // Process overdue reminders immediately on startup
      tick().catch((error) => {
        logger.error({ error }, "Error in initial reminder poll");
      });

      // Set up recurring interval
      intervalHandle = setInterval(() => {
        tick().catch((error) => {
          logger.error({ error }, "Error in reminder poll interval");
        });
      }, POLL_INTERVAL_MS);
    },

    /**
     * Stop the poller.
     * Clears the interval -- any in-flight tick will complete naturally.
     */
    stop(): void {
      if (intervalHandle !== null) {
        clearInterval(intervalHandle);
        intervalHandle = null;
      }
      logger.info("Reminder poller stopped");
    },

    /**
     * Exposed for testing -- run a single poll cycle.
     */
    tick,
  };
}
