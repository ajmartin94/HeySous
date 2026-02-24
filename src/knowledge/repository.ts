import { eq, and, desc } from "drizzle-orm";
import type { DrizzleDatabase } from "../db/index.js";
import { knowledgeItems, knowledgeTags } from "./schema.js";
import type { KnowledgeItem } from "./types.js";

interface CreateKnowledgeInput {
  title: string;
  summary: string;
  content: string;
  source?: string;
  sourceUrl?: string;
  tags: string[];
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  totalTimeMinutes?: number | null;
}

interface UpdateKnowledgeInput {
  title?: string;
  summary?: string;
  content?: string;
  source?: string;
  tags?: string[];
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  totalTimeMinutes?: number | null;
}

/**
 * Factory function for knowledge CRUD operations.
 * All operations filter by householdId for per-household knowledge isolation.
 */
export function createKnowledgeRepository(db: DrizzleDatabase) {
  function buildKnowledgeItem(
    item: typeof knowledgeItems.$inferSelect,
    tags: string[]
  ): KnowledgeItem {
    return {
      id: item.id,
      householdId: item.householdId,
      title: item.title,
      summary: item.summary,
      content: item.content,
      source: item.source,
      sourceUrl: item.sourceUrl ?? null,
      tags,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      lastAccessedAt: item.lastAccessedAt,
      version: item.version,
      updatedBy: item.updatedBy ?? null,
      prepTimeMinutes: item.prepTimeMinutes ?? null,
      cookTimeMinutes: item.cookTimeMinutes ?? null,
      totalTimeMinutes: item.totalTimeMinutes ?? null,
    };
  }

  return {
    /**
     * Create a new knowledge item with tags.
     */
    create(householdId: string, input: CreateKnowledgeInput): KnowledgeItem {
      const inserted = db
        .insert(knowledgeItems)
        .values({
          householdId,
          title: input.title,
          summary: input.summary,
          content: input.content,
          source: input.source ?? null,
          sourceUrl: input.sourceUrl ?? null,
          prepTimeMinutes: input.prepTimeMinutes ?? null,
          cookTimeMinutes: input.cookTimeMinutes ?? null,
          totalTimeMinutes: input.totalTimeMinutes ?? null,
        })
        .returning()
        .get();

      if (!inserted) {
        throw new Error("Failed to insert knowledge item");
      }

      // Insert tags
      if (input.tags.length > 0) {
        db.insert(knowledgeTags)
          .values(
            input.tags.map((tag) => ({
              knowledgeItemId: inserted.id,
              tag,
            }))
          )
          .run();
      }

      return buildKnowledgeItem(inserted, input.tags);
    },

    /**
     * Get a knowledge item by ID, filtered by householdId for security.
     */
    getById(id: number, householdId: string): KnowledgeItem | null {
      const item = db
        .select()
        .from(knowledgeItems)
        .where(
          and(eq(knowledgeItems.id, id), eq(knowledgeItems.householdId, householdId))
        )
        .get();

      if (!item) return null;

      const tags = db
        .select({ tag: knowledgeTags.tag })
        .from(knowledgeTags)
        .where(eq(knowledgeTags.knowledgeItemId, id))
        .all()
        .map((r) => r.tag);

      return buildKnowledgeItem(item, tags);
    },

    /**
     * Update a knowledge item. If tags provided, replaces all tags.
     * Supports optimistic locking: if expectedVersion is provided, the update
     * only succeeds when the current version matches. Returns null on conflict.
     */
    update(
      id: number,
      householdId: string,
      changes: UpdateKnowledgeInput,
      options?: { expectedVersion?: number; updatedBy?: string },
    ): KnowledgeItem | null {
      // Verify item exists and belongs to householdId
      const existing = db
        .select()
        .from(knowledgeItems)
        .where(
          and(eq(knowledgeItems.id, id), eq(knowledgeItems.householdId, householdId))
        )
        .get();

      if (!existing) return null;

      // Optimistic locking: check version matches expected
      if (options?.expectedVersion !== undefined && existing.version !== options.expectedVersion) {
        return null; // Conflict detected
      }

      // Build update values (only specified fields)
      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
        version: existing.version + 1,
      };
      if (options?.updatedBy !== undefined) updateValues.updatedBy = options.updatedBy;
      if (changes.title !== undefined) updateValues.title = changes.title;
      if (changes.summary !== undefined) updateValues.summary = changes.summary;
      if (changes.content !== undefined) updateValues.content = changes.content;
      if (changes.source !== undefined) updateValues.source = changes.source;
      if (changes.prepTimeMinutes !== undefined) updateValues.prepTimeMinutes = changes.prepTimeMinutes;
      if (changes.cookTimeMinutes !== undefined) updateValues.cookTimeMinutes = changes.cookTimeMinutes;
      if (changes.totalTimeMinutes !== undefined) updateValues.totalTimeMinutes = changes.totalTimeMinutes;

      db.update(knowledgeItems)
        .set(updateValues)
        .where(
          and(eq(knowledgeItems.id, id), eq(knowledgeItems.householdId, householdId))
        )
        .run();

      // Replace tags if provided
      if (changes.tags !== undefined) {
        db.delete(knowledgeTags)
          .where(eq(knowledgeTags.knowledgeItemId, id))
          .run();

        if (changes.tags.length > 0) {
          db.insert(knowledgeTags)
            .values(
              changes.tags.map((tag) => ({
                knowledgeItemId: id,
                tag,
              }))
            )
            .run();
        }
      }

      // Return updated item
      return this.getById(id, householdId);
    },

    /**
     * Delete a knowledge item. Cascade deletes tags.
     * Returns true if item was deleted.
     */
    delete(id: number, householdId: string): boolean {
      const result = db
        .delete(knowledgeItems)
        .where(
          and(eq(knowledgeItems.id, id), eq(knowledgeItems.householdId, householdId))
        )
        .run();

      return result.changes > 0;
    },

    /**
     * List all knowledge items for a household, ordered by lastAccessedAt desc.
     * Default limit 50.
     */
    listByHouseholdId(householdId: string, limit: number = 50): KnowledgeItem[] {
      const items = db
        .select()
        .from(knowledgeItems)
        .where(eq(knowledgeItems.householdId, householdId))
        .orderBy(desc(knowledgeItems.lastAccessedAt))
        .limit(limit)
        .all();

      return items.map((item) => {
        const tags = db
          .select({ tag: knowledgeTags.tag })
          .from(knowledgeTags)
          .where(eq(knowledgeTags.knowledgeItemId, item.id))
          .all()
          .map((r) => r.tag);

        return buildKnowledgeItem(item, tags);
      });
    },
  };
}
