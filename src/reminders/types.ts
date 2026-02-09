/**
 * Reminder types for the three reminder categories.
 */
export type ReminderType = "morning_summary" | "prep_alert" | "start_cooking";

/**
 * Status of a scheduled reminder.
 */
export type ReminderStatus = "pending" | "sent" | "failed";

/**
 * Per-chat reminder settings with timezone and time preferences.
 */
export interface ReminderSettings {
  id: number;
  chatId: string;
  /** IANA timezone identifier, e.g. "America/New_York" */
  timezone: string;
  /** Morning summary time in "HH:MM" format, default "08:00" */
  morningTime: string;
  /** Dinner prep/cooking time in "HH:MM" format, default "17:30" */
  dinnerTime: string;
  /** Whether morning summary reminders are enabled */
  morningEnabled: boolean;
  /** Whether prep alert reminders are enabled */
  prepAlertsEnabled: boolean;
  /** If set, all reminders muted until this time */
  mutedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A scheduled reminder instance.
 */
export interface Reminder {
  id: number;
  chatId: string;
  type: ReminderType;
  /** When the reminder should fire (UTC) */
  dueAt: Date;
  status: ReminderStatus;
  /** JSON with meal info for Claude to generate reminder text */
  contextJson: string;
  /** Cached Claude-generated reminder text */
  generatedText: string | null;
  /** When the reminder was actually sent */
  sentAt: Date | null;
  createdAt: Date;
}
