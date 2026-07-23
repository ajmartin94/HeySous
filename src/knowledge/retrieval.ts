import type BetterSqlite3 from "better-sqlite3";
import type { Logger } from "pino";
import type { DrizzleDatabase } from "../db/index.js";
import type {
  KnowledgeItem,
  RetrievalMetrics,
  SearchResult,
} from "./types.js";
import { searchFts, getFullItem } from "./fts.js";
import { estimateTokens } from "./token-budget.js";

/** Default soft token limit for search result summaries (pass 1). */
const DEFAULT_SOFT_LIMIT = 4000;

/**
 * Create a retrieval service implementing two-pass search with token budget enforcement.
 *
 * Pass 1 (search): Returns BM25-ranked summaries within the token budget.
 *   - Budget is against title + summary text (what Claude sees before requesting full content).
 *   - Results trimmed from the end (least relevant) when over soft limit.
 *   - Among equal-relevance items, recency wins (secondary sort by lastAccessedAt desc).
 *
 * Pass 2 (getItem): Returns full content for a specific item by ID.
 *   - Updates last_accessed_at for recency tracking.
 *
 * Factory pattern matches codebase conventions (createDatabase, createClaudeClient).
 */
export function createRetrievalService(deps: {
  sqlite: BetterSqlite3.Database;
  db: DrizzleDatabase;
  logger: Logger;
}) {
  const { sqlite, logger } = deps;

  const metricsPerChat = new Map<string, RetrievalMetrics>();

  return {
    /**
     * Pass 1: Search knowledge items by query, returning summaries within token budget.
     * Results are BM25-ranked with recency as tiebreaker.
     */
    search(
      householdId: string,
      query: string,
      limit: number = 5,
    ): { results: SearchResult[]; metrics: RetrievalMetrics } {
      const startTime = performance.now();

      let results: SearchResult[];
      try {
        // "wide" mode: prefix + OR + LIKE fallback so a few keywords are enough
        // and near-misses surface (see searchFts). Precision-sensitive callers
        // (dedup) use the default "strict" mode instead.
        results = searchFts(sqlite, query, householdId, limit, "wide");
      } catch (error) {
        // Defensive: searchFts has its own try/catch with LIKE fallback,
        // but handle unexpected errors gracefully
        logger.warn(
          { error, query, householdId },
          "Unexpected error during knowledge search",
        );
        results = [];
      }

      const itemsSearched = results.length;

      // Secondary sort: among equal-relevance items, recency wins (most recent first)
      results.sort((a, b) => {
        const relevanceDiff = b.relevance - a.relevance;
        if (Math.abs(relevanceDiff) > 0.001) return relevanceDiff;
        return b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime();
      });

      // Token budget enforcement: trim from end (least relevant) until within soft limit
      let tokensUsed = 0;
      const budgetedResults: SearchResult[] = [];

      for (const result of results) {
        const resultText = result.title + " " + result.summary;
        const resultTokens = estimateTokens(resultText);
        const newTotal = tokensUsed + resultTokens;

        if (newTotal > DEFAULT_SOFT_LIMIT && budgetedResults.length > 0) {
          // Would exceed soft limit and we already have some results -- stop
          break;
        }

        budgetedResults.push(result);
        tokensUsed = newTotal;
      }

      const queryTimeMs = Math.round(performance.now() - startTime);

      metricsPerChat.set(householdId, {
        itemsSearched,
        itemsReturned: budgetedResults.length,
        tokensUsed,
        queryTimeMs,
      });

      logger.info(
        {
          householdId,
          query,
          itemsSearched,
          itemsReturned: budgetedResults.length,
          tokensUsed,
          queryTimeMs,
        },
        "Knowledge search completed",
      );

      return { results: budgetedResults, metrics: { ...metricsPerChat.get(householdId)! } };
    },

    /**
     * Pass 2: Get full content for a specific knowledge item by ID.
     * Updates last_accessed_at for recency tracking.
     */
    getItem(id: number, householdId: string): KnowledgeItem | null {
      return getFullItem(sqlite, id, householdId);
    },

    /**
     * Get metrics from the most recent search call for a specific household.
     * Used by /debug command to surface retrieval performance.
     * Returns zeroes if no search has occurred for the given household.
     */
    getMetrics(householdId?: string): RetrievalMetrics {
      if (householdId) {
        const metrics = metricsPerChat.get(householdId);
        if (metrics) return { ...metrics };
      }
      return {
        itemsSearched: 0,
        itemsReturned: 0,
        tokensUsed: 0,
        queryTimeMs: 0,
      };
    },
  };
}
