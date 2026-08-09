import { describe, expect, it } from "vitest";
import { getToolStatusLabel, stripToolStatusLines } from "../../src/ai/tool-status.js";

describe("stripToolStatusLines", () => {
  /**
   * Status decorations are rendered by the stream sender, but the whole
   * accumulated string used to be persisted to the messages table -- so they
   * replayed as conversation history. Sous learned that emitting
   * "<i>Updating your meal plan...</i>" IS the action and began typing it
   * instead of calling the tool: a plan entry for brownies was confirmed to
   * the user and never saved.
   */
  it("removes a leading status line and its separator", () => {
    const text = "\n\n<i>Updating your meal plan...</i>\n\nAdded bread as a side.";
    expect(stripToolStatusLines(text)).toBe("Added bread as a side.");
  });

  it("removes a status line the model typed itself, with no separator", () => {
    const text = "<i>Updating your meal plan...</i>\n\nAdded brownies for dessert.";
    expect(stripToolStatusLines(text)).toBe("Added brownies for dessert.");
  });

  it("removes several stacked status lines", () => {
    const text =
      "\n\n<i>Importing recipe from URL...</i>\n\n<i>Saving to your recipe book...</i>\n\nSaved it!";
    expect(stripToolStatusLines(text)).toBe("Saved it!");
  });

  it("removes status lines that appear mid-message", () => {
    const text = "Let me look.\n\n<i>Searching recipes...</i>\n\nFound three.";
    expect(stripToolStatusLines(text)).toBe("Let me look.\n\nFound three.");
  });

  it("removes the generic fallback label for unknown tools", () => {
    expect(stripToolStatusLines(`<i>${getToolStatusLabel("brand_new_tool")}</i>\n\nDone.`)).toBe("Done.");
  });

  /** Recipe cards are full of legitimate italics -- those must survive. */
  it("preserves italics that are not status labels", () => {
    const text = "<b>Roasted Okra</b>\n<i>american | dinner | 25 min | easy</i>\n\nGreat side.";
    expect(stripToolStatusLines(text)).toBe(text);
  });

  it("preserves prose that merely mentions a tool in passing", () => {
    const text = "I'll be updating your meal plan shortly.";
    expect(stripToolStatusLines(text)).toBe(text);
  });

  it("returns an empty string when the message was only status lines", () => {
    expect(stripToolStatusLines("\n\n<i>Searching recipes...</i>\n\n<i>Reading recipe details...</i>")).toBe("");
  });

  it("leaves untouched text alone", () => {
    expect(stripToolStatusLines("Just a normal reply.")).toBe("Just a normal reply.");
    expect(stripToolStatusLines("")).toBe("");
  });
});
