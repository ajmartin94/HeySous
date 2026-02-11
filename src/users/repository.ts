import type BetterSqlite3 from "better-sqlite3";
import type { CreateUserParams, Household, User } from "./types.js";

/** Raw row shape from SQLite for the users table. */
interface UserRow {
  id: number;
  telegram_id: string;
  display_name: string;
  username: string | null;
  household_id: string;
  role: string;
  onboarding_state: string;
  created_at: number;
  updated_at: number;
}

/** Raw row shape from SQLite for the households table. */
interface HouseholdRow {
  id: string;
  name: string;
  created_by: string;
  created_at: number;
}

/** Map a raw users row to the User interface. */
function mapUser(row: UserRow): User {
  return {
    id: row.id,
    telegramId: row.telegram_id,
    displayName: row.display_name,
    username: row.username,
    householdId: row.household_id,
    role: row.role as User["role"],
    onboardingState: row.onboarding_state as User["onboardingState"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Map a raw households row to the Household interface. */
function mapHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/** Get a user by their Telegram ID. */
export function getUserByTelegramId(
  sqlite: BetterSqlite3.Database,
  telegramId: string,
): User | undefined {
  const row = sqlite
    .prepare(`SELECT * FROM users WHERE telegram_id = ?`)
    .get(telegramId) as UserRow | undefined;

  return row ? mapUser(row) : undefined;
}

/** Create a new user and return the created record. */
export function createUser(
  sqlite: BetterSqlite3.Database,
  params: CreateUserParams,
): User {
  const result = sqlite
    .prepare(
      `INSERT INTO users (telegram_id, display_name, username, household_id, role, onboarding_state)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      params.telegramId,
      params.displayName,
      params.username,
      params.householdId,
      params.role,
      params.onboardingState,
    );

  const row = sqlite
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .get(result.lastInsertRowid) as UserRow;

  return mapUser(row);
}

/** Get all members of a household. */
export function getHouseholdMembers(
  sqlite: BetterSqlite3.Database,
  householdId: string,
): User[] {
  const rows = sqlite
    .prepare(`SELECT * FROM users WHERE household_id = ?`)
    .all(householdId) as UserRow[];

  return rows.map(mapUser);
}

/** Create a new household. */
export function createHousehold(
  sqlite: BetterSqlite3.Database,
  params: { id: string; name: string; createdBy: string },
): void {
  sqlite
    .prepare(
      `INSERT INTO households (id, name, created_by) VALUES (?, ?, ?)`,
    )
    .run(params.id, params.name, params.createdBy);
}

/** Get a household by its ID. */
export function getHouseholdById(
  sqlite: BetterSqlite3.Database,
  householdId: string,
): Household | undefined {
  const row = sqlite
    .prepare(`SELECT * FROM households WHERE id = ?`)
    .get(householdId) as HouseholdRow | undefined;

  return row ? mapHousehold(row) : undefined;
}

/**
 * Auto-update a household's name based on its current members.
 * Naming logic:
 *   1 member  -> "Name's household"
 *   2 members -> "Name1 & Name2's household"
 *   3+ members -> "Name1, Name2 & Name3's household"
 */
export function updateHouseholdName(
  sqlite: BetterSqlite3.Database,
  householdId: string,
): void {
  const members = getHouseholdMembers(sqlite, householdId);

  let name: string;
  if (members.length === 0) {
    name = "My Household";
  } else if (members.length === 1) {
    name = `${members[0].displayName}'s household`;
  } else if (members.length === 2) {
    name = `${members[0].displayName} & ${members[1].displayName}'s household`;
  } else {
    const allButLast = members
      .slice(0, -1)
      .map((m) => m.displayName)
      .join(", ");
    name = `${allButLast} & ${members[members.length - 1].displayName}'s household`;
  }

  sqlite
    .prepare(`UPDATE households SET name = ? WHERE id = ?`)
    .run(name, householdId);
}

/**
 * Update a user's onboarding state and return the updated user.
 *
 * @returns The updated User, or undefined if no user was found
 *          with the given telegramId.
 */
export function updateOnboardingState(
  sqlite: BetterSqlite3.Database,
  telegramId: string,
  newState: User["onboardingState"],
): User | undefined {
  sqlite
    .prepare(
      `UPDATE users SET onboarding_state = ?, updated_at = unixepoch() WHERE telegram_id = ?`,
    )
    .run(newState, telegramId);

  return getUserByTelegramId(sqlite, telegramId);
}

/** Get the admin user (first user with role='admin'). */
export function getAdmin(
  sqlite: BetterSqlite3.Database,
): User | undefined {
  const row = sqlite
    .prepare(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`)
    .get() as UserRow | undefined;

  return row ? mapUser(row) : undefined;
}
