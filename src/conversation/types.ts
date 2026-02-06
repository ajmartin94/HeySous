/**
 * Conversation types for message history and context building.
 *
 * ConversationTurn maps directly to the existing `messages` table schema
 * from Phase 1 -- no new table needed.
 */

export interface ConversationTurn {
  id: number;
  chatId: string;
  userId: string;
  text: string;
  direction: "in" | "out";
  createdAt: Date;
}
