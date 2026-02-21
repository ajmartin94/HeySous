import { describe, it, expect } from "vitest";
import {
  parseIsoDuration,
  stripHtml,
  cleanTitle,
  normalizeInstructions,
  extractJsonLd,
  extractMicrodata,
} from "../../src/knowledge/url-import.js";

describe("parseIsoDuration", () => {
  it("parses hours and minutes", () => {
    expect(parseIsoDuration("PT1H30M")).toBe("1 hour 30 minutes");
  });

  it("parses minutes only", () => {
    expect(parseIsoDuration("PT45M")).toBe("45 minutes");
  });

  it("parses hours only", () => {
    expect(parseIsoDuration("PT2H")).toBe("2 hours");
  });

  it("handles singular hour", () => {
    expect(parseIsoDuration("PT1H")).toBe("1 hour");
  });

  it("handles singular minute", () => {
    expect(parseIsoDuration("PT1M")).toBe("1 minute");
  });

  it("returns original string for non-ISO format", () => {
    expect(parseIsoDuration("30 minutes")).toBe("30 minutes");
  });

  it("returns empty string for empty input", () => {
    expect(parseIsoDuration("")).toBe("");
  });
});

describe("stripHtml", () => {
  it("removes HTML tags", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("decodes HTML entities", () => {
    expect(stripHtml("Mac &amp; Cheese")).toBe("Mac & Cheese");
  });

  it("handles &nbsp;", () => {
    expect(stripHtml("Hello&nbsp;World")).toBe("Hello World");
  });

  it("collapses whitespace", () => {
    expect(stripHtml("  Hello   World  ")).toBe("Hello World");
  });

  it("returns empty for empty input", () => {
    expect(stripHtml("")).toBe("");
  });
});

describe("cleanTitle", () => {
  it("removes site name suffix", () => {
    expect(cleanTitle("Chicken Parm - AllRecipes")).toBe("Chicken Parm");
  });

  it("removes .com suffix", () => {
    expect(cleanTitle("Pasta Bolognese - FoodBlog.com")).toBe("Pasta Bolognese");
  });

  it("removes | separator", () => {
    expect(cleanTitle("Tacos | Serious Eats")).toBe("Tacos");
  });

  it("removes trailing 'Recipe' suffix", () => {
    expect(cleanTitle("Chicken Soup - Recipe")).toBe("Chicken Soup");
  });

  it("preserves clean titles", () => {
    expect(cleanTitle("Classic Chicken Parmesan")).toBe("Classic Chicken Parmesan");
  });

  it("returns empty for empty input", () => {
    expect(cleanTitle("")).toBe("");
  });
});

describe("normalizeInstructions", () => {
  it("handles array of strings", () => {
    expect(normalizeInstructions(["Step 1", "Step 2"])).toEqual(["Step 1", "Step 2"]);
  });

  it("handles array of HowToStep objects", () => {
    const input = [
      { "@type": "HowToStep", text: "Preheat oven" },
      { "@type": "HowToStep", text: "Mix ingredients" },
    ];
    expect(normalizeInstructions(input)).toEqual(["Preheat oven", "Mix ingredients"]);
  });

  it("handles single string with newlines", () => {
    expect(normalizeInstructions("Step 1\nStep 2\nStep 3")).toEqual(["Step 1", "Step 2", "Step 3"]);
  });

  it("strips HTML from instructions", () => {
    expect(normalizeInstructions(["<p>Preheat the <b>oven</b></p>"])).toEqual(["Preheat the oven"]);
  });

  it("filters empty entries", () => {
    expect(normalizeInstructions(["Step 1", "", "Step 2"])).toEqual(["Step 1", "Step 2"]);
  });

  it("returns empty array for null input", () => {
    expect(normalizeInstructions(null)).toEqual([]);
  });
});

describe("extractJsonLd", () => {
  it("extracts recipe from valid JSON-LD", () => {
    const html = `
      <html><head>
      <script type="application/ld+json">
      {
        "@type": "Recipe",
        "name": "Chicken Parmesan",
        "recipeIngredient": ["2 chicken breasts", "1 cup mozzarella"],
        "recipeInstructions": ["Pound chicken", "Bread and fry"],
        "prepTime": "PT15M",
        "cookTime": "PT30M",
        "recipeYield": "4 servings"
      }
      </script>
      </head><body></body></html>
    `;

    const result = extractJsonLd(html, "https://example.com/recipe");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Chicken Parmesan");
    expect(result!.ingredients).toEqual(["2 chicken breasts", "1 cup mozzarella"]);
    expect(result!.instructions).toEqual(["Pound chicken", "Bread and fry"]);
    expect(result!.prepTime).toBe("15 minutes");
    expect(result!.cookTime).toBe("30 minutes");
    expect(result!.servings).toBe("4 servings");
    expect(result!.extractionMethod).toBe("json-ld");
    expect(result!.sourceUrl).toBe("https://example.com/recipe");
  });

  it("extracts recipe from @graph array", () => {
    const html = `
      <html><head>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebPage", "name": "My Blog" },
          {
            "@type": "Recipe",
            "name": "Spaghetti Bolognese",
            "recipeIngredient": ["1 lb pasta", "1 lb ground beef"],
            "recipeInstructions": [
              { "@type": "HowToStep", "text": "Cook pasta" },
              { "@type": "HowToStep", "text": "Make sauce" }
            ]
          }
        ]
      }
      </script>
      </head><body></body></html>
    `;

    const result = extractJsonLd(html, "https://example.com");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Spaghetti Bolognese");
    expect(result!.instructions).toEqual(["Cook pasta", "Make sauce"]);
  });

  it("handles Recipe type as array", () => {
    const html = `
      <html><head>
      <script type="application/ld+json">
      {
        "@type": ["Recipe", "HowTo"],
        "name": "Quick Tacos",
        "recipeIngredient": ["tortillas", "ground beef"],
        "recipeInstructions": "Cook beef and assemble"
      }
      </script>
      </head><body></body></html>
    `;

    const result = extractJsonLd(html, "https://example.com");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Quick Tacos");
  });

  it("returns null when no recipe JSON-LD found", () => {
    const html = `
      <html><head>
      <script type="application/ld+json">
      { "@type": "Article", "name": "Not a Recipe" }
      </script>
      </head><body></body></html>
    `;

    const result = extractJsonLd(html, "https://example.com");
    expect(result).toBeNull();
  });

  it("returns null when no JSON-LD script exists", () => {
    const html = `<html><head></head><body><p>Hello</p></body></html>`;
    const result = extractJsonLd(html, "https://example.com");
    expect(result).toBeNull();
  });

  it("cleans SEO title suffix", () => {
    const html = `
      <html><head>
      <script type="application/ld+json">
      {
        "@type": "Recipe",
        "name": "Chicken Parm - AllRecipes",
        "recipeIngredient": ["chicken"],
        "recipeInstructions": ["Cook it"]
      }
      </script>
      </head><body></body></html>
    `;

    const result = extractJsonLd(html, "https://example.com");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Chicken Parm");
  });
});

describe("extractMicrodata", () => {
  it("extracts recipe from Microdata attributes", () => {
    const html = `
      <html><body>
      <div itemscope itemtype="https://schema.org/Recipe">
        <h1 itemprop="name">Thai Basil Stir Fry</h1>
        <span itemprop="description">A quick Thai stir fry</span>
        <span itemprop="recipeIngredient">1 cup basil</span>
        <span itemprop="recipeIngredient">2 tbsp soy sauce</span>
        <div itemprop="recipeInstructions">Heat wok and stir fry</div>
        <meta itemprop="prepTime" content="PT10M">
        <span itemprop="recipeYield">2 servings</span>
      </div>
      </body></html>
    `;

    const result = extractMicrodata(html, "https://example.com");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Thai Basil Stir Fry");
    expect(result!.ingredients).toEqual(["1 cup basil", "2 tbsp soy sauce"]);
    expect(result!.instructions).toEqual(["Heat wok and stir fry"]);
    expect(result!.prepTime).toBe("10 minutes");
    expect(result!.servings).toBe("2 servings");
    expect(result!.extractionMethod).toBe("microdata");
  });

  it("returns null when no Recipe Microdata found", () => {
    const html = `<html><body><p>No microdata here</p></body></html>`;
    const result = extractMicrodata(html, "https://example.com");
    expect(result).toBeNull();
  });
});
