import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { initializeMemoryFts } from "../../src/memory/fts.js";
import {
  saveMemory,
  updateMemory,
  deleteMemory,
  getMemoriesByHousehold,
  getMemoryById,
} from "../../src/memory/repository.js";

vi.mock("../../src/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const HOUSEHOLD_ID = "test-household";
const OTHER_HOUSEHOLD = "other-household";

describe("Memory Repository CRUD", () => {
  let sqlite: InstanceType<typeof Database>;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    initializeMemoryFts(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  describe("saveMemory", () => {
    it("inserts a row and returns { id, content, category }", () => {
      const result = saveMemory(sqlite, HOUSEHOLD_ID, "Allergic to peanuts", "dietary");
      expect(result).toEqual({
        id: expect.any(Number),
        content: "Allergic to peanuts",
        category: "dietary",
      });
      expect(result.id).toBeGreaterThan(0);
    });

    it("defaults category to 'general' when not specified", () => {
      const result = saveMemory(sqlite, HOUSEHOLD_ID, "Some random fact");
      expect(result.category).toBe("general");
    });

    it("accepts all valid categories", () => {
      const categories = [
        "dietary",
        "taste",
        "cooking_style",
        "household",
        "schedule",
        "logistics",
        "general",
      ] as const;

      for (const category of categories) {
        const result = saveMemory(sqlite, HOUSEHOLD_ID, `Fact for ${category}`, category);
        expect(result.category).toBe(category);
      }
    });
  });

  describe("updateMemory", () => {
    it("returns true and changes content for existing ID", () => {
      const saved = saveMemory(sqlite, HOUSEHOLD_ID, "Original content", "general");
      const updated = updateMemory(sqlite, saved.id, "Updated content");
      expect(updated).toBe(true);

      const fetched = getMemoryById(sqlite, saved.id, HOUSEHOLD_ID);
      expect(fetched).not.toBeNull();
      expect(fetched!.content).toBe("Updated content");
    });

    it("returns false for nonexistent ID", () => {
      const result = updateMemory(sqlite, 9999, "New content");
      expect(result).toBe(false);
    });
  });

  describe("deleteMemory", () => {
    it("returns true and removes row when ID + householdId match", () => {
      const saved = saveMemory(sqlite, HOUSEHOLD_ID, "To be deleted", "general");
      const deleted = deleteMemory(sqlite, saved.id, HOUSEHOLD_ID);
      expect(deleted).toBe(true);

      const fetched = getMemoryById(sqlite, saved.id, HOUSEHOLD_ID);
      expect(fetched).toBeNull();
    });

    it("returns false when householdId does not match (cross-household guard)", () => {
      const saved = saveMemory(sqlite, HOUSEHOLD_ID, "Protected memory", "dietary");
      const deleted = deleteMemory(sqlite, saved.id, OTHER_HOUSEHOLD);
      expect(deleted).toBe(false);

      // Original still exists
      const fetched = getMemoryById(sqlite, saved.id, HOUSEHOLD_ID);
      expect(fetched).not.toBeNull();
    });

    it("returns false for nonexistent ID", () => {
      const result = deleteMemory(sqlite, 9999, HOUSEHOLD_ID);
      expect(result).toBe(false);
    });
  });

  describe("getMemoriesByHousehold", () => {
    it("returns memories ordered by category ASC, created_at DESC", () => {
      // Use raw SQL with explicit timestamps to guarantee distinct created_at values
      const insert = sqlite.prepare(
        "INSERT INTO memories (household_id, content, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      );
      insert.run(HOUSEHOLD_ID, "Taste fact 1", "taste", 1000, 1000);
      insert.run(HOUSEHOLD_ID, "Dietary fact 1", "dietary", 1001, 1001);
      insert.run(HOUSEHOLD_ID, "Taste fact 2", "taste", 1002, 1002);
      insert.run(HOUSEHOLD_ID, "Dietary fact 2", "dietary", 1003, 1003);

      const memories = getMemoriesByHousehold(sqlite, HOUSEHOLD_ID);
      expect(memories).toHaveLength(4);

      // dietary comes before taste alphabetically
      expect(memories[0].category).toBe("dietary");
      expect(memories[1].category).toBe("dietary");
      expect(memories[2].category).toBe("taste");
      expect(memories[3].category).toBe("taste");

      // Within same category, created_at DESC (newer first)
      expect(memories[0].content).toBe("Dietary fact 2");
      expect(memories[1].content).toBe("Dietary fact 1");
      expect(memories[2].content).toBe("Taste fact 2");
      expect(memories[3].content).toBe("Taste fact 1");
    });

    it("returns empty array for unknown household", () => {
      saveMemory(sqlite, HOUSEHOLD_ID, "Exists", "general");
      const memories = getMemoriesByHousehold(sqlite, "nonexistent-household");
      expect(memories).toEqual([]);
    });

    it("respects limit parameter", () => {
      for (let i = 0; i < 5; i++) {
        saveMemory(sqlite, HOUSEHOLD_ID, `Memory ${i}`, "general");
      }
      const memories = getMemoriesByHousehold(sqlite, HOUSEHOLD_ID, 3);
      expect(memories).toHaveLength(3);
    });
  });

  describe("getMemoryById", () => {
    it("returns Memory for valid ID + householdId", () => {
      const saved = saveMemory(sqlite, HOUSEHOLD_ID, "Test memory", "dietary");
      const memory = getMemoryById(sqlite, saved.id, HOUSEHOLD_ID);

      expect(memory).not.toBeNull();
      expect(memory!.id).toBe(saved.id);
      expect(memory!.content).toBe("Test memory");
      expect(memory!.category).toBe("dietary");
      expect(memory!.householdId).toBe(HOUSEHOLD_ID);
      expect(memory!.createdAt).toBeInstanceOf(Date);
      expect(memory!.updatedAt).toBeInstanceOf(Date);
    });

    it("returns null for wrong householdId (isolation)", () => {
      const saved = saveMemory(sqlite, HOUSEHOLD_ID, "Private memory", "general");
      const memory = getMemoryById(sqlite, saved.id, OTHER_HOUSEHOLD);
      expect(memory).toBeNull();
    });

    it("returns null for nonexistent ID", () => {
      const memory = getMemoryById(sqlite, 9999, HOUSEHOLD_ID);
      expect(memory).toBeNull();
    });
  });
});
