export interface IngredientGroup {
  heading: string | null; // null = no sub-section header
  items: string[];
}

export interface FeedbackEntry {
  date: string;
  sentiment: "positive" | "neutral" | "negative";
  notes: string;
}

export interface ParsedRecipe {
  ingredientGroups: IngredientGroup[];
  steps: string[];
  metadata: {
    prepTime?: string;
    cookTime?: string;
    totalTime?: string;
    servings?: string;
  };
  notes: string[];
  feedback: FeedbackEntry[];
}

/**
 * Parse recipe content text into structured sections for rendering.
 * Handles: Ingredients (with sub-groups), Steps, metadata lines,
 * Notes, and Feedback entries. All sections are optional.
 */
export function parseRecipeContent(content: string): ParsedRecipe {
  const lines = content.split("\n");
  let currentSection: "" | "ingredients" | "steps" | "notes" | "feedback" = "";

  const result: ParsedRecipe = {
    ingredientGroups: [],
    steps: [],
    metadata: {},
    notes: [],
    feedback: [],
  };

  let currentIngredientGroup: IngredientGroup = { heading: null, items: [] };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect section headers (case-insensitive)
    if (/^ingredients:/i.test(trimmed)) {
      currentSection = "ingredients";
      continue;
    }
    if (/^steps:/i.test(trimmed)) {
      // Push any pending ingredient group before switching sections
      if (currentIngredientGroup.items.length > 0) {
        result.ingredientGroups.push(currentIngredientGroup);
        currentIngredientGroup = { heading: null, items: [] };
      }
      currentSection = "steps";
      continue;
    }
    if (/^notes:/i.test(trimmed)) {
      currentSection = "notes";
      continue;
    }
    if (/^feedback:/i.test(trimmed)) {
      currentSection = "feedback";
      continue;
    }

    // Detect metadata lines (not under a section, or anywhere)
    const metaMatch = trimmed.match(
      /^(prep time|cook time|total time|servings):\s*(.+)/i
    );
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      if (key === "prep time") result.metadata.prepTime = metaMatch[2];
      if (key === "cook time") result.metadata.cookTime = metaMatch[2];
      if (key === "total time") result.metadata.totalTime = metaMatch[2];
      if (key === "servings") result.metadata.servings = metaMatch[2];
      continue;
    }

    // Process based on current section
    switch (currentSection) {
      case "ingredients":
        // Sub-section header (e.g., "For the crust:")
        if (trimmed.endsWith(":") && !trimmed.startsWith("-")) {
          if (currentIngredientGroup.items.length > 0) {
            result.ingredientGroups.push(currentIngredientGroup);
          }
          currentIngredientGroup = {
            heading: trimmed.slice(0, -1),
            items: [],
          };
        } else if (trimmed.startsWith("-")) {
          currentIngredientGroup.items.push(trimmed.slice(1).trim());
        }
        break;

      case "steps": {
        // Strip leading number and period/parenthesis
        const stepText = trimmed.replace(/^\d+[.)]\s*/, "");
        if (stepText) result.steps.push(stepText);
        break;
      }

      case "notes":
        if (trimmed.startsWith("-")) {
          result.notes.push(trimmed.slice(1).trim());
        } else {
          result.notes.push(trimmed);
        }
        break;

      case "feedback": {
        // Parse: "- 2026-01-15 [positive]: loved it"
        const fbMatch = trimmed.match(
          /^-\s*(\d{4}-\d{2}-\d{2})\s*\[(\w+)\]:\s*(.+)/
        );
        if (fbMatch) {
          result.feedback.push({
            date: fbMatch[1],
            sentiment: fbMatch[2] as FeedbackEntry["sentiment"],
            notes: fbMatch[3],
          });
        }
        break;
      }
    }
  }

  // Push final ingredient group if it has items
  if (currentIngredientGroup.items.length > 0) {
    result.ingredientGroups.push(currentIngredientGroup);
  }

  return result;
}

/**
 * Derive a rating label from feedback entries.
 * Returns null if no feedback exists.
 */
export function computeRating(
  feedback: FeedbackEntry[]
): { netScore: number; total: number; label: string | null } | null {
  if (feedback.length === 0) return null;

  let positive = 0;
  let negative = 0;
  for (const fb of feedback) {
    if (fb.sentiment === "positive") positive++;
    if (fb.sentiment === "negative") negative++;
  }

  const netScore = positive - negative;
  const total = feedback.length;

  let label: string | null = null;
  if (total >= 2 && netScore >= 2) label = "favorite";
  else if (netScore > 0) label = "liked";
  else if (netScore === 0 && total > 0) label = "mixed";
  else if (netScore < 0) label = "needs work";

  return { netScore, total, label };
}
