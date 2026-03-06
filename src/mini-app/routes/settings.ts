import type { Request, Response } from "express";
import type BetterSqlite3 from "better-sqlite3";

/** Shape returned by GET /api/settings and accepted (partially) by PUT /api/settings. */
interface SettingsPayload {
  timezone: string;
  morning_time: string;
  breakfast_time: string;
  lunch_time: string;
  snack_time: string;
  dinner_time: string;
  dessert_time: string;
  morning_enabled: boolean;
  prep_alerts_enabled: boolean;
  muted_until: number | null;
}

/** Columns that can be updated via PUT. */
const UPDATABLE_FIELDS = new Set([
  "timezone",
  "morning_time",
  "breakfast_time",
  "lunch_time",
  "snack_time",
  "dinner_time",
  "dessert_time",
  "morning_enabled",
  "prep_alerts_enabled",
  "muted_until",
]);

interface SettingsRow {
  timezone: string;
  morning_time: string;
  breakfast_time: string;
  lunch_time: string;
  snack_time: string;
  dinner_time: string;
  dessert_time: string;
  morning_enabled: number;
  prep_alerts_enabled: number;
  muted_until: number | null;
}

function rowToPayload(row: SettingsRow): SettingsPayload {
  return {
    timezone: row.timezone,
    morning_time: row.morning_time,
    breakfast_time: row.breakfast_time,
    lunch_time: row.lunch_time,
    snack_time: row.snack_time,
    dinner_time: row.dinner_time,
    dessert_time: row.dessert_time,
    morning_enabled: row.morning_enabled === 1,
    prep_alerts_enabled: row.prep_alerts_enabled === 1,
    muted_until: row.muted_until,
  };
}

/**
 * Factory function for settings API routes.
 * Returns handlers for GET /api/settings and PUT /api/settings.
 */
export function createSettingsRoutes(sqlite: BetterSqlite3.Database) {
  const getSettings = (_req: Request, res: Response) => {
    const householdId = res.locals.householdId as string;

    const row = sqlite
      .prepare(
        `SELECT timezone, morning_time, breakfast_time, lunch_time, snack_time,
                dinner_time, dessert_time, morning_enabled, prep_alerts_enabled, muted_until
         FROM application_settings
         WHERE household_id = ?`,
      )
      .get(householdId) as SettingsRow | undefined;

    if (!row) {
      // Return defaults if no settings row exists yet
      res.json({
        timezone: "America/New_York",
        morning_time: "08:00",
        breakfast_time: "07:00",
        lunch_time: "12:00",
        snack_time: "15:00",
        dinner_time: "17:30",
        dessert_time: "20:00",
        morning_enabled: true,
        prep_alerts_enabled: true,
        muted_until: null,
      } satisfies SettingsPayload);
      return;
    }

    res.json(rowToPayload(row));
  };

  const updateSettings = (req: Request, res: Response) => {
    const householdId = res.locals.householdId as string;
    const body = req.body as Record<string, unknown>;

    // Filter to only updatable fields that are present in the body
    const updates: Array<{ column: string; value: unknown }> = [];
    for (const [key, value] of Object.entries(body)) {
      if (UPDATABLE_FIELDS.has(key)) {
        // Convert booleans to integers for SQLite
        const sqlValue =
          typeof value === "boolean" ? (value ? 1 : 0) : value;
        updates.push({ column: key, value: sqlValue });
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }

    // Ensure a settings row exists (upsert)
    sqlite
      .prepare(
        `INSERT OR IGNORE INTO application_settings (household_id) VALUES (?)`,
      )
      .run(householdId);

    // Build dynamic UPDATE
    const setClauses = updates.map((u) => `${u.column} = ?`).join(", ");
    const values = updates.map((u) => u.value);

    sqlite
      .prepare(
        `UPDATE application_settings
         SET ${setClauses}, updated_at = unixepoch()
         WHERE household_id = ?`,
      )
      .run(...values, householdId);

    // Return the updated row
    const row = sqlite
      .prepare(
        `SELECT timezone, morning_time, breakfast_time, lunch_time, snack_time,
                dinner_time, dessert_time, morning_enabled, prep_alerts_enabled, muted_until
         FROM application_settings
         WHERE household_id = ?`,
      )
      .get(householdId) as SettingsRow;

    res.json(rowToPayload(row));
  };

  return { getSettings, updateSettings };
}
