import type { Request, Response } from "express";
import type BetterSqlite3 from "better-sqlite3";
import { escapeForFts5 } from "../../knowledge/fts.js";

/**
 * Factory function for recipe browsing API route handlers.
 * Returns an object with two handlers: getList and getDetail.
 *
 * Follows the same factory pattern as createGroceryRoutes (grocery.ts).
 * All handlers expect res.locals.chatId to be set by auth middleware.
 */
export function createRecipeRoutes(sqlite: BetterSqlite3.Database) {
  return {
    /**
     * GET /api/recipes?q=...&tag=...&sort=recent|alphabetical|most_cooked&limit=50
     * Returns recipe cards with title, summary, tags, last-cooked date,
     * cook count, and feedback rating for the authenticated user.
     */
    getList(req: Request, res: Response) {
      const chatId = res.locals.chatId as string;
      const { q, tag, sort, limit } = req.query;

      const maxResults = Math.min(Number(limit) || 50, 100);
      const sortBy = (sort as string) || "recent";

      const hasSearch = typeof q === "string" && q.trim().length > 0;
      const hasTag = typeof tag === "string" && tag.trim().length > 0;

      try {
        let rows: Array<{
          id: number;
          title: string;
          summary: string;
          updated_at: number;
          tags: string | null;
          last_cooked: string | null;
          cook_count: number;
          relevance?: number;
        }>;

        if (hasSearch) {
          const escaped = escapeForFts5(q as string);
          if (!escaped) {
            res.json({ recipes: [] });
            return;
          }

          // Path C or D: FTS5 search (with optional tag filter)
          let sql = `
            SELECT ki.id, ki.title, ki.summary, ki.updated_at,
                   GROUP_CONCAT(DISTINCT kt.tag) AS tags,
                   bm25(knowledge_fts, 10.0, 5.0, 1.0) AS relevance,
                   (SELECT MAX(ch.cooked_date) FROM cooking_history ch
                    WHERE ch.knowledge_item_id = ki.id AND ch.chat_id = ki.chat_id) AS last_cooked,
                   (SELECT COUNT(*) FROM cooking_history ch
                    WHERE ch.knowledge_item_id = ki.id AND ch.chat_id = ki.chat_id) AS cook_count
            FROM knowledge_fts
            JOIN knowledge_items ki ON ki.id = knowledge_fts.rowid
            JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id
            WHERE knowledge_fts MATCH ?
              AND ki.chat_id = ?
              AND ki.id IN (SELECT knowledge_item_id FROM knowledge_tags WHERE tag = 'recipe')
          `;
          const params: (string | number)[] = [escaped, chatId];

          if (hasTag) {
            sql += `  AND ki.id IN (SELECT knowledge_item_id FROM knowledge_tags WHERE tag = ?)\n`;
            params.push(tag as string);
          }

          sql += `GROUP BY ki.id\n`;

          // When FTS active, default to relevance sort unless explicitly overridden
          if (sortBy === "alphabetical") {
            sql += `ORDER BY ki.title ASC\n`;
          } else if (sortBy === "most_cooked") {
            sql += `ORDER BY cook_count DESC, ki.title ASC\n`;
          } else {
            // Default: relevance (BM25 lower = better match)
            sql += `ORDER BY relevance ASC\n`;
          }

          sql += `LIMIT ?`;
          params.push(maxResults);

          rows = sqlite.prepare(sql).all(...params) as typeof rows;
        } else {
          // Path A or B: No search (with optional tag filter)
          let sql = `
            SELECT ki.id, ki.title, ki.summary, ki.updated_at,
                   GROUP_CONCAT(DISTINCT kt.tag) AS tags,
                   (SELECT MAX(ch.cooked_date) FROM cooking_history ch
                    WHERE ch.knowledge_item_id = ki.id AND ch.chat_id = ki.chat_id) AS last_cooked,
                   (SELECT COUNT(*) FROM cooking_history ch
                    WHERE ch.knowledge_item_id = ki.id AND ch.chat_id = ki.chat_id) AS cook_count
            FROM knowledge_items ki
            JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id
            WHERE ki.chat_id = ?
              AND ki.id IN (SELECT knowledge_item_id FROM knowledge_tags WHERE tag = 'recipe')
          `;
          const params: (string | number)[] = [chatId];

          if (hasTag) {
            sql += `  AND ki.id IN (SELECT knowledge_item_id FROM knowledge_tags WHERE tag = ?)\n`;
            params.push(tag as string);
          }

          sql += `GROUP BY ki.id\n`;

          if (sortBy === "alphabetical") {
            sql += `ORDER BY ki.title ASC\n`;
          } else if (sortBy === "most_cooked") {
            sql += `ORDER BY cook_count DESC, ki.title ASC\n`;
          } else {
            // Default: recent
            sql += `ORDER BY ki.updated_at DESC\n`;
          }

          sql += `LIMIT ?`;
          params.push(maxResults);

          rows = sqlite.prepare(sql).all(...params) as typeof rows;
        }

        const recipes = rows.map((row) => ({
          id: row.id,
          title: row.title,
          summary: row.summary,
          tags: row.tags ? row.tags.split(",") : [],
          lastCooked: row.last_cooked || null,
          cookCount: row.cook_count || 0,
        }));

        res.json({ recipes });
      } catch {
        // FTS5 parse error -- fall back to non-search query
        let sql = `
          SELECT ki.id, ki.title, ki.summary, ki.updated_at,
                 GROUP_CONCAT(DISTINCT kt.tag) AS tags,
                 (SELECT MAX(ch.cooked_date) FROM cooking_history ch
                  WHERE ch.knowledge_item_id = ki.id AND ch.chat_id = ki.chat_id) AS last_cooked,
                 (SELECT COUNT(*) FROM cooking_history ch
                  WHERE ch.knowledge_item_id = ki.id AND ch.chat_id = ki.chat_id) AS cook_count
          FROM knowledge_items ki
          JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id
          WHERE ki.chat_id = ?
            AND ki.id IN (SELECT knowledge_item_id FROM knowledge_tags WHERE tag = 'recipe')
        `;
        const params: (string | number)[] = [chatId];

        if (hasTag) {
          sql += `  AND ki.id IN (SELECT knowledge_item_id FROM knowledge_tags WHERE tag = ?)\n`;
          params.push(tag as string);
        }

        sql += `GROUP BY ki.id\nORDER BY ki.updated_at DESC\nLIMIT ?`;
        params.push(maxResults);

        const rows = sqlite.prepare(sql).all(...params) as Array<{
          id: number;
          title: string;
          summary: string;
          updated_at: number;
          tags: string | null;
          last_cooked: string | null;
          cook_count: number;
        }>;

        const recipes = rows.map((row) => ({
          id: row.id,
          title: row.title,
          summary: row.summary,
          tags: row.tags ? row.tags.split(",") : [],
          lastCooked: row.last_cooked || null,
          cookCount: row.cook_count || 0,
        }));

        res.json({ recipes });
      }
    },

    /**
     * GET /api/recipes/:id
     * Returns the full recipe content, tags, last-cooked date, and cook count.
     */
    getDetail(req: Request, res: Response) {
      const chatId = res.locals.chatId as string;
      const id = Number(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid recipe ID" });
        return;
      }

      const row = sqlite
        .prepare(
          `
          SELECT ki.id, ki.title, ki.summary, ki.content, ki.updated_at,
                 GROUP_CONCAT(DISTINCT kt.tag) AS tags,
                 (SELECT MAX(ch.cooked_date) FROM cooking_history ch
                  WHERE ch.knowledge_item_id = ki.id AND ch.chat_id = ki.chat_id) AS last_cooked,
                 (SELECT COUNT(*) FROM cooking_history ch
                  WHERE ch.knowledge_item_id = ki.id AND ch.chat_id = ki.chat_id) AS cook_count
          FROM knowledge_items ki
          JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id
          WHERE ki.id = ? AND ki.chat_id = ?
          GROUP BY ki.id
        `
        )
        .get(id, chatId) as
        | {
            id: number;
            title: string;
            summary: string;
            content: string;
            updated_at: number;
            tags: string | null;
            last_cooked: string | null;
            cook_count: number;
          }
        | undefined;

      if (!row) {
        res.status(404).json({ error: "Recipe not found" });
        return;
      }

      // Update last_accessed_at for detail view (acceptable per research)
      sqlite
        .prepare(
          "UPDATE knowledge_items SET last_accessed_at = ? WHERE id = ? AND chat_id = ?"
        )
        .run(Math.floor(Date.now() / 1000), id, chatId);

      const recipe = {
        id: row.id,
        title: row.title,
        summary: row.summary,
        content: row.content,
        tags: row.tags ? row.tags.split(",") : [],
        lastCooked: row.last_cooked || null,
        cookCount: row.cook_count || 0,
      };

      res.json({ recipe });
    },
  };
}
