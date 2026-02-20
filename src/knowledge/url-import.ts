/**
 * Recipe URL Import Module
 *
 * Fetches recipe pages and extracts structured data using a 3-strategy pipeline:
 * 1. JSON-LD (schema.org Recipe type) -- preferred, covers ~80% of recipe sites
 * 2. Microdata (itemprop attributes) -- fallback for older sites
 * 3. Raw text truncation -- last resort, Claude parses the content
 *
 * All external fetches use timeouts, size caps, and browser-like headers.
 * The module never throws -- all errors are captured in the ImportResult.
 */

import * as cheerio from "cheerio";
import { logger } from "../logger.js";

/** Maximum response size (2MB) */
const MAX_RESPONSE_SIZE = 2 * 1024 * 1024;

/** HTTP fetch timeout (10 seconds) */
const FETCH_TIMEOUT_MS = 10_000;

/** Browser-like User-Agent to avoid anti-scraping blocks */
const USER_AGENT = "Mozilla/5.0 (compatible; HeySous/1.0; recipe-import)";

/** Maximum raw text length for Claude fallback */
const MAX_RAW_TEXT_LENGTH = 4000;

export interface ExtractedRecipe {
  title: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  servings?: string;
  description?: string;
  sourceUrl: string;
  extractionMethod: "json-ld" | "microdata" | "raw-text";
}

export interface ImportResult {
  success: boolean;
  recipe?: ExtractedRecipe;
  rawText?: string;
  error?: string;
  suggestion?: string;
}

/**
 * Parse an ISO 8601 duration string into human-readable format.
 * Examples: "PT1H30M" -> "1 hour 30 minutes", "PT45M" -> "45 minutes"
 */
export function parseIsoDuration(iso: string): string {
  if (!iso || typeof iso !== "string") return "";

  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return iso; // Return original if not parseable

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);

  return parts.join(" ") || iso;
}

/**
 * Strip HTML tags from a string and decode common entities.
 */
export function stripHtml(html: string): string {
  if (!html || typeof html !== "string") return "";

  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clean a recipe title by removing common SEO suffixes.
 * Examples: "Chicken Parm - AllRecipes" -> "Chicken Parm"
 */
export function cleanTitle(title: string): string {
  if (!title || typeof title !== "string") return "";

  // Remove common site name suffixes
  return title
    .replace(/\s*[-|]\s*[^-|]+\.(com|org|net|co)\s*$/i, "")
    .replace(/\s*[-|]\s*(AllRecipes|Food Network|Serious Eats|NYT Cooking|Epicurious|Bon App[eé]tit|Taste of Home|Simply Recipes|Budget Bytes|Delish|Tasty)\s*$/i, "")
    .replace(/\s*[-|]\s*Recipe\s*$/i, "")
    .trim();
}

/**
 * Normalize recipe instructions from various formats into a string array.
 * Handles: string, string[], {text: string}[], {name: string, text: string}[]
 */
export function normalizeInstructions(raw: unknown): string[] {
  if (!raw) return [];

  if (typeof raw === "string") {
    // Split on newlines or numbered steps
    return raw
      .split(/\n+/)
      .map((s) => stripHtml(s).trim())
      .filter((s) => s.length > 0);
  }

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === "string") return stripHtml(item).trim();
        if (item && typeof item === "object") {
          // HowToStep or HowToSection
          const obj = item as Record<string, unknown>;
          if (obj.text) return stripHtml(String(obj.text)).trim();
          if (obj.name) return stripHtml(String(obj.name)).trim();
          // HowToSection with itemListElement
          if (Array.isArray(obj.itemListElement)) {
            return (obj.itemListElement as Array<Record<string, unknown>>)
              .map((sub) => stripHtml(String(sub.text || sub.name || "")).trim())
              .filter((s) => s.length > 0)
              .join("\n");
          }
        }
        return "";
      })
      .filter((s) => s.length > 0);
  }

  return [];
}

/**
 * Normalize recipe ingredients from various formats into a string array.
 */
function normalizeIngredients(raw: unknown): string[] {
  if (!raw) return [];

  if (typeof raw === "string") {
    return raw
      .split(/\n+/)
      .map((s) => stripHtml(s).trim())
      .filter((s) => s.length > 0);
  }

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === "string") return stripHtml(item).trim();
        return "";
      })
      .filter((s) => s.length > 0);
  }

  return [];
}

/**
 * Find a Recipe object in JSON-LD data, which can be:
 * - A single object with @type: "Recipe"
 * - An array with a Recipe object
 * - An object with @graph array containing a Recipe object
 */
function findRecipeInJsonLd(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;

  // Direct Recipe object
  if (!Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const type = obj["@type"];
    if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) {
      return obj;
    }
    // Check @graph
    if (Array.isArray(obj["@graph"])) {
      for (const item of obj["@graph"]) {
        const found = findRecipeInJsonLd(item);
        if (found) return found;
      }
    }
    return null;
  }

  // Array of objects
  for (const item of data) {
    const found = findRecipeInJsonLd(item);
    if (found) return found;
  }

  return null;
}

/**
 * Extract recipe from JSON-LD structured data.
 * This is the preferred extraction method (Strategy A).
 */
export function extractJsonLd(html: string, url: string): ExtractedRecipe | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < scripts.length; i++) {
    try {
      const text = $(scripts[i]).html();
      if (!text) continue;

      const data = JSON.parse(text);
      const recipe = findRecipeInJsonLd(data);
      if (!recipe) continue;

      const title = cleanTitle(stripHtml(String(recipe.name || "")));
      if (!title) continue;

      return {
        title,
        ingredients: normalizeIngredients(recipe.recipeIngredient),
        instructions: normalizeInstructions(recipe.recipeInstructions),
        prepTime: recipe.prepTime ? parseIsoDuration(String(recipe.prepTime)) : undefined,
        cookTime: recipe.cookTime ? parseIsoDuration(String(recipe.cookTime)) : undefined,
        totalTime: recipe.totalTime ? parseIsoDuration(String(recipe.totalTime)) : undefined,
        servings: recipe.recipeYield ? stripHtml(String(Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : recipe.recipeYield)) : undefined,
        description: recipe.description ? stripHtml(String(recipe.description)) : undefined,
        sourceUrl: url,
        extractionMethod: "json-ld",
      };
    } catch {
      // JSON parse failure for this script block -- try the next one
      continue;
    }
  }

  return null;
}

/**
 * Extract recipe from Microdata (itemprop attributes).
 * This is the first fallback (Strategy B).
 */
export function extractMicrodata(html: string, url: string): ExtractedRecipe | null {
  const $ = cheerio.load(html);

  // Find the Recipe itemscope
  const recipeScope = $('[itemtype*="schema.org/Recipe"]');
  if (recipeScope.length === 0) return null;

  const scope = recipeScope.first();

  const title = cleanTitle(stripHtml(scope.find('[itemprop="name"]').first().text()));
  if (!title) return null;

  const ingredients = scope
    .find('[itemprop="recipeIngredient"], [itemprop="ingredients"]')
    .map((_, el) => stripHtml($(el).text()).trim())
    .get()
    .filter((s: string) => s.length > 0);

  const instructions = scope
    .find('[itemprop="recipeInstructions"]')
    .map((_, el) => stripHtml($(el).text()).trim())
    .get()
    .filter((s: string) => s.length > 0);

  const prepTimeEl = scope.find('[itemprop="prepTime"]');
  const cookTimeEl = scope.find('[itemprop="cookTime"]');
  const totalTimeEl = scope.find('[itemprop="totalTime"]');
  const servingsEl = scope.find('[itemprop="recipeYield"]');
  const descriptionEl = scope.find('[itemprop="description"]');

  return {
    title,
    ingredients,
    instructions,
    prepTime: prepTimeEl.length ? parseIsoDuration(prepTimeEl.attr("content") || prepTimeEl.text()) : undefined,
    cookTime: cookTimeEl.length ? parseIsoDuration(cookTimeEl.attr("content") || cookTimeEl.text()) : undefined,
    totalTime: totalTimeEl.length ? parseIsoDuration(totalTimeEl.attr("content") || totalTimeEl.text()) : undefined,
    servings: servingsEl.length ? stripHtml(servingsEl.text()) : undefined,
    description: descriptionEl.length ? stripHtml(descriptionEl.text()) : undefined,
    sourceUrl: url,
    extractionMethod: "microdata",
  };
}

/**
 * Fetch a URL and extract recipe data using the 3-strategy pipeline.
 * This is the main entry point called by the tool handler.
 *
 * Never throws -- all errors are captured in the ImportResult.
 */
export async function fetchAndParseRecipe(url: string): Promise<ImportResult> {
  // Validate URL
  if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
    return {
      success: false,
      error: "Invalid URL. Please provide a URL starting with http:// or https://.",
      suggestion: "Double-check the URL and try again, or paste the recipe text directly.",
    };
  }

  let html: string;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      if (response.status === 403) {
        return {
          success: false,
          error: `That site returned a 403 Forbidden response.`,
          suggestion: "The site might be blocking automated access. Try copy-pasting the recipe text instead.",
        };
      }
      if (response.status === 404) {
        return {
          success: false,
          error: `Page not found (404).`,
          suggestion: "Double-check the URL -- it might have moved or been deleted.",
        };
      }
      if (response.status === 402 || response.status === 451) {
        return {
          success: false,
          error: `That recipe appears to be behind a paywall.`,
          suggestion: "If you can see the recipe, try copy-pasting the text instead.",
        };
      }
      return {
        success: false,
        error: `The site returned an error (HTTP ${response.status}).`,
        suggestion: "Try again later, or paste the recipe text directly.",
      };
    }

    // Check content type
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return {
        success: false,
        error: "That URL doesn't appear to be a web page.",
        suggestion: "Make sure the URL points to a recipe page, not a PDF or image.",
      };
    }

    // Read with size limit
    const text = await response.text();
    if (text.length > MAX_RESPONSE_SIZE) {
      return {
        success: false,
        error: "That page is too large for me to process.",
        suggestion: "Try sharing the recipe text directly instead.",
      };
    }

    html = text;
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        success: false,
        error: "That URL took too long to respond (over 10 seconds).",
        suggestion: "The site might be slow or down. Try again later, or paste the recipe text.",
      };
    }
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn({ url, error: msg }, "URL fetch failed for recipe import");
    return {
      success: false,
      error: `Could not fetch that URL: ${msg}`,
      suggestion: "Check that the URL is correct, or try pasting the recipe text instead.",
    };
  }

  // Strategy A: JSON-LD
  const jsonLdRecipe = extractJsonLd(html, url);
  if (jsonLdRecipe && jsonLdRecipe.ingredients.length > 0) {
    return { success: true, recipe: jsonLdRecipe };
  }

  // Strategy B: Microdata
  const microdataRecipe = extractMicrodata(html, url);
  if (microdataRecipe && microdataRecipe.ingredients.length > 0) {
    return { success: true, recipe: microdataRecipe };
  }

  // Strategy C: Raw text fallback for Claude to parse
  const $ = cheerio.load(html);
  // Remove script and style elements
  $("script, style, nav, header, footer").remove();
  const bodyText = stripHtml($.text());
  const truncatedText = bodyText.slice(0, MAX_RAW_TEXT_LENGTH);

  if (truncatedText.length < 100) {
    return {
      success: false,
      error: "I couldn't find recipe content on that page.",
      suggestion: "Is this the right URL? If the recipe is behind a login, try pasting the text.",
    };
  }

  return {
    success: true,
    rawText: truncatedText,
    recipe: {
      title: cleanTitle($("title").text() || "Imported Recipe"),
      ingredients: [],
      instructions: [],
      sourceUrl: url,
      extractionMethod: "raw-text",
    },
  };
}
