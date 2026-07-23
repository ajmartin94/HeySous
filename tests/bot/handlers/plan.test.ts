import { describe, it, expect } from "vitest";
import { formatPlanMessage, type PlanRow } from "../../../src/bot/handlers/plan.js";

/**
 * Tests for /plan message formatting -- specifically HTML escaping of
 * recipe names. Telegram uses HTML parse mode globally; an unescaped
 * recipe name containing &, <, or > causes a "can't parse entities"
 * error from Telegram and the whole /plan reply silently fails.
 */
describe("formatPlanMessage", () => {
  const weekStartDate = "2026-07-20"; // a Monday

  it("escapes an ampersand in a recipe name (dinner-only mode)", () => {
    const entries: PlanRow[] = [
      { recipe_name: "Chicken & Rice", day_of_week: 1, meal_type: "dinner" },
    ];

    const message = formatPlanMessage(entries, weekStartDate);

    expect(message).toContain("Chicken &amp; Rice");
    expect(message).not.toContain("Chicken & Rice");
  });

  it("escapes angle brackets in a recipe name (dinner-only mode)", () => {
    const entries: PlanRow[] = [
      { recipe_name: "<script>alert(1)</script>", day_of_week: 2, meal_type: "dinner" },
    ];

    const message = formatPlanMessage(entries, weekStartDate);

    expect(message).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(message).not.toContain("<script>");
  });

  it("escapes recipe names in multi-meal mode (grouped by day)", () => {
    const entries: PlanRow[] = [
      { recipe_name: "Mac & Cheese", day_of_week: 1, meal_type: "breakfast" },
      { recipe_name: "Steak <medium>", day_of_week: 1, meal_type: "dinner" },
    ];

    const message = formatPlanMessage(entries, weekStartDate);

    expect(message).toContain("Mac &amp; Cheese");
    expect(message).toContain("Steak &lt;medium&gt;");
    expect(message).not.toContain("Mac & Cheese");
    expect(message).not.toContain("<medium>");
  });

  it("leaves plain recipe names unchanged", () => {
    const entries: PlanRow[] = [
      { recipe_name: "Chicken Parmesan", day_of_week: 3, meal_type: "dinner" },
    ];

    const message = formatPlanMessage(entries, weekStartDate);

    expect(message).toContain("Chicken Parmesan");
  });

  it("still produces well-formed <b> day headers alongside escaped content", () => {
    const entries: PlanRow[] = [
      { recipe_name: "Fish & Chips", day_of_week: 4, meal_type: "lunch" },
    ];

    const message = formatPlanMessage(entries, weekStartDate);

    expect(message).toContain("<b>Friday</b>");
    expect(message).toContain("Fish &amp; Chips");
  });
});
