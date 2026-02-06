import type { TokenBudgetConfig } from "./types.js";

const DEFAULT_CONFIG: TokenBudgetConfig = {
  knowledgeSoftLimit: 4000,
  knowledgeHardLimit: 6000,
  conversationBudget: 2000,
};

/**
 * Estimate token count for a text string.
 * Uses the 4 chars/token heuristic (reasonable for English text).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Factory for token budget allocation.
 * Knowledge gets priority over conversation per user decision.
 */
export function createTokenBudget(config?: Partial<TokenBudgetConfig>) {
  const resolvedConfig: TokenBudgetConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  return {
    /**
     * Allocate tokens between knowledge and conversation text.
     * Priority: knowledge > conversation.
     *
     * - If knowledge fits within soft limit (4K), remaining goes to conversation.
     * - If knowledge exceeds soft but within hard (6K), allocate it, reduce conversation.
     * - If knowledge exceeds hard limit, truncate to hard limit.
     */
    allocate(
      knowledgeText: string,
      conversationText: string
    ): {
      knowledgeTokens: number;
      conversationTokens: number;
      withinBudget: boolean;
    } {
      const knowledgeTokens = estimateTokens(knowledgeText);
      const conversationTokens = estimateTokens(conversationText);

      const { knowledgeSoftLimit, knowledgeHardLimit, conversationBudget } =
        resolvedConfig;

      let allocatedKnowledge: number;
      let allocatedConversation: number;
      let withinBudget: boolean;

      if (knowledgeTokens <= knowledgeSoftLimit) {
        // Knowledge fits comfortably -- allocate remaining to conversation
        allocatedKnowledge = knowledgeTokens;
        allocatedConversation = Math.min(conversationTokens, conversationBudget);
        withinBudget = true;
      } else if (knowledgeTokens <= knowledgeHardLimit) {
        // Knowledge exceeds soft but within hard -- allocate it, reduce conversation
        allocatedKnowledge = knowledgeTokens;
        const remainingBudget = Math.max(
          0,
          conversationBudget - (knowledgeTokens - knowledgeSoftLimit)
        );
        allocatedConversation = Math.min(conversationTokens, remainingBudget);
        withinBudget = true;
      } else {
        // Knowledge exceeds hard limit -- truncate
        allocatedKnowledge = knowledgeHardLimit;
        allocatedConversation = 0;
        withinBudget = false;
      }

      return {
        knowledgeTokens: allocatedKnowledge,
        conversationTokens: allocatedConversation,
        withinBudget,
      };
    },

    /**
     * Select items that fit within the token budget.
     * Items should already be sorted by relevance (most relevant first).
     * Recency breaks ties among equal-relevance items.
     *
     * If a highly relevant item pushes past soft limit but stays under hard,
     * it is included.
     */
    fitItemsWithinBudget<T extends { text: string; lastAccessedAt: Date }>(
      items: T[],
      softLimit?: number,
      hardLimit?: number
    ): T[] {
      const soft = softLimit ?? resolvedConfig.knowledgeSoftLimit;
      const hard = hardLimit ?? resolvedConfig.knowledgeHardLimit;

      const selected: T[] = [];
      let totalTokens = 0;

      for (const item of items) {
        const itemTokens = estimateTokens(item.text);
        const newTotal = totalTokens + itemTokens;

        if (newTotal <= soft) {
          // Fits within soft limit -- include
          selected.push(item);
          totalTokens = newTotal;
        } else if (newTotal <= hard) {
          // Exceeds soft but within hard -- include (flex zone)
          selected.push(item);
          totalTokens = newTotal;
        } else {
          // Would exceed hard limit -- stop
          break;
        }
      }

      return selected;
    },

    /**
     * Get the current token budget configuration.
     */
    getConfig(): TokenBudgetConfig {
      return { ...resolvedConfig };
    },
  };
}
