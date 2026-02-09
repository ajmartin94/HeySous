/** Sentiment values from check-in buttons or Claude extraction. */
export type FeedbackSentiment = "positive" | "neutral" | "negative" | "skipped";

/** Status of a feedback check-in. */
export type FeedbackCheckinStatus = "pending" | "sent" | "responded" | "expired";

/** A feedback check-in tracking record. */
export interface FeedbackCheckin {
  id: number;
  chatId: string;
  reminderId: number;
  /** Meals included in this check-in (JSON array) */
  mealsJson: string;
  status: FeedbackCheckinStatus;
  sentiment: FeedbackSentiment | null;
  notes: string | null;
  respondedAt: Date | null;
  createdAt: Date;
}
