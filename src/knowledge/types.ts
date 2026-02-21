export interface KnowledgeItem {
  id: number;
  householdId: string;
  title: string;
  summary: string;
  content: string;
  source: string | null;
  sourceUrl: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
}

export interface SearchResult {
  id: number;
  title: string;
  summary: string;
  relevance: number;
  tags: string[];
  lastAccessedAt: Date;
}

export interface RetrievalMetrics {
  itemsSearched: number;
  itemsReturned: number;
  tokensUsed: number;
  queryTimeMs: number;
}

export interface TokenBudgetConfig {
  knowledgeSoftLimit: number;
  knowledgeHardLimit: number;
  conversationBudget: number;
}

export interface ChangelogEntry {
  id: number;
  knowledgeItemId: number;
  householdId: string;
  action: "create" | "update" | "delete";
  changeDescription: string | null;
  previousContent: string | null;
  createdAt: Date;
}
