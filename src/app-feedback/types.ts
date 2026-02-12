/** Source channels for app feedback collection. */
export type AppFeedbackSource = "command" | "implicit" | "mini-app" | "proactive";

/** A stored app feedback record. */
export interface AppFeedback {
  id: number;
  householdId: string;
  userId: string;
  text: string;
  source: AppFeedbackSource;
  createdAt: number;
}

/** Parameters for saving app feedback. */
export interface SaveFeedbackParams {
  householdId: string;
  userId: string;
  text: string;
  source: AppFeedbackSource;
}
