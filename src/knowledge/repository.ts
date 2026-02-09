import { eq, and, desc } from "drizzle-orm";
import type { DrizzleDatabase } from "../db/index.js";
import { knowledgeItems, knowledgeTags } from "./schema.js";
import type { KnowledgeItem } from "./types.js";

interface CreateKnowledgeInput {
  title: string;
  summary: string;
  content: string;
  source?: string;
  tags: string[];
}

interface UpdateKnowledgeInput {
  title?: string;
  summary?: string;
  content?: string;
  source?: string;
  tags?: string[];
}

/**
 * Factory function for knowledge CRUD operations.
 * All operations filter by chatId for per-user knowledge isolation.
 */
export function createKnowledgeRepository(db: DrizzleDatabase) {
  function buildKnowledgeItem(
    item: typeof knowledgeItems.$inferSelect,
    tags: string[]
  ): KnowledgeItem {
    return {
      id: item.id,
      chatId: item.chatId,
      title: item.title,
      summary: item.summary,
      content: item.content,
      source: item.source,
      tags,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      lastAccessedAt: item.lastAccessedAt,
    };
  }

  return {
    /**
     * Create a new knowledge item with tags.
     */
    create(chatId: string, input: CreateKnowledgeInput): KnowledgeItem {
      const inserted = db
        .insert(knowledgeItems)
        .values({
          chatId,
          title: input.title,
          summary: input.summary,
          content: input.content,
          source: input.source ?? null,
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
     * Get a knowledge item by ID, filtered by chatId for security.
     */
    getById(id: number, chatId: string): KnowledgeItem | null {
      const item = db
        .select()
        .from(knowledgeItems)
        .where(
          and(eq(knowledgeItems.id, id), eq(knowledgeItems.chatId, chatId))
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
     */
    update(
      id: number,
      chatId: string,
      changes: UpdateKnowledgeInput
    ): KnowledgeItem | null {
      // Verify item exists and belongs to chatId
      const existing = db
        .select()
        .from(knowledgeItems)
        .where(
          and(eq(knowledgeItems.id, id), eq(knowledgeItems.chatId, chatId))
        )
        .get();

      if (!existing) return null;

      // Build update values (only specified fields)
      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (changes.title !== undefined) updateValues.title = changes.title;
      if (changes.summary !== undefined) updateValues.summary = changes.summary;
      if (changes.content !== undefined) updateValues.content = changes.content;
      if (changes.source !== undefined) updateValues.source = changes.source;

      db.update(knowledgeItems)
        .set(updateValues)
        .where(
          and(eq(knowledgeItems.id, id), eq(knowledgeItems.chatId, chatId))
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
      return this.getById(id, chatId);
    },

    /**
     * Delete a knowledge item. Cascade deletes tags.
     * Returns true if item was deleted.
     */
    delete(id: number, chatId: string): boolean {
      const result = db
        .delete(knowledgeItems)
        .where(
          and(eq(knowledgeItems.id, id), eq(knowledgeItems.chatId, chatId))
        )
        .run();

      return result.changes > 0;
    },

    /**
     * List all knowledge items for a chat, ordered by lastAccessedAt desc.
     * Default limit 50.
     */
    listByChatId(chatId: string, limit: number = 50): KnowledgeItem[] {
      const items = db
        .select()
        .from(knowledgeItems)
        .where(eq(knowledgeItems.chatId, chatId))
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
