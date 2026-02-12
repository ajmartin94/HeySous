import type BetterSqlite3 from "better-sqlite3";
import type { CreateInviteParams, InviteToken } from "./types.js";

/** Raw row shape from SQLite for the invite_tokens table. */
interface InviteTokenRow {
  id: number;
  token: string;
  household_id: string;
  invite_type: string;
  created_by: string;
  redeemed_by: string | null;
  redeemed_at: number | null;
  expires_at: number;
  created_at: number;
}

/** Map a raw invite_tokens row to the InviteToken interface. */
function mapToken(row: InviteTokenRow): InviteToken {
  return {
    id: row.id,
    token: row.token,
    householdId: row.household_id,
    inviteType: row.invite_type as InviteToken["inviteType"],
    createdBy: row.created_by,
    redeemedBy: row.redeemed_by,
    redeemedAt: row.redeemed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/** Create a new invite token and return the created record. */
export function createInviteToken(
  sqlite: BetterSqlite3.Database,
  params: CreateInviteParams,
): InviteToken {
  const result = sqlite
    .prepare(
      `INSERT INTO invite_tokens (token, household_id, invite_type, created_by, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      params.token,
      params.householdId,
      params.inviteType,
      params.createdBy,
      params.expiresAt,
    );

  const row = sqlite
    .prepare(`SELECT * FROM invite_tokens WHERE id = ?`)
    .get(result.lastInsertRowid) as InviteTokenRow;

  return mapToken(row);
}

/**
 * Atomically validate and redeem an invite token.
 * Returns the token record if valid (unredeemed + not expired), or null.
 * On success, marks the token as redeemed with the given user's telegram ID.
 */
export function getAndRedeemToken(
  sqlite: BetterSqlite3.Database,
  tokenValue: string,
  redeemedByTelegramId: string,
): InviteToken | null {
  // Find valid (unredeemed, unexpired) token
  const row = sqlite
    .prepare(
      `SELECT * FROM invite_tokens
       WHERE token = ? AND redeemed_by IS NULL AND expires_at > unixepoch()`,
    )
    .get(tokenValue) as InviteTokenRow | undefined;

  if (!row) {
    return null;
  }

  // Mark as redeemed
  sqlite
    .prepare(
      `UPDATE invite_tokens SET redeemed_by = ?, redeemed_at = unixepoch()
       WHERE id = ?`,
    )
    .run(redeemedByTelegramId, row.id);

  return mapToken(row);
}

/** Get a token by its value (for inspection, not redemption). */
export function getTokenByValue(
  sqlite: BetterSqlite3.Database,
  tokenValue: string,
): InviteToken | undefined {
  const row = sqlite
    .prepare(`SELECT * FROM invite_tokens WHERE token = ?`)
    .get(tokenValue) as InviteTokenRow | undefined;

  return row ? mapToken(row) : undefined;
}
