import type BetterSqlite3 from "better-sqlite3";
import { createHousehold, createUser, getHouseholdById } from "../../../src/users/repository.js";

/**
 * Register a member in a household, creating the household first if it
 * doesn't already exist yet. Safe to call multiple times with the same
 * `householdId` to add several members to one household.
 */
export function seedHousehold(
  sqlite: BetterSqlite3.Database,
  opts: {
    householdId: string;
    telegramId: string;
    displayName?: string;
    role?: "admin" | "member";
  },
): { householdId: string; telegramId: string } {
  if (!getHouseholdById(sqlite, opts.householdId)) {
    createHousehold(sqlite, {
      id: opts.householdId,
      name: `${opts.displayName ?? "Test"}'s household`,
      createdBy: opts.telegramId,
    });
  }

  createUser(sqlite, {
    telegramId: opts.telegramId,
    displayName: opts.displayName ?? "Test User",
    username: null,
    householdId: opts.householdId,
    role: opts.role ?? "member",
    onboardingState: "complete",
  });

  return { householdId: opts.householdId, telegramId: opts.telegramId };
}
