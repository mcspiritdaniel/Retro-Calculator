import { describe, expect, it } from "vitest";
import { searchHelpRecipes } from "./help-search";

describe("searchHelpRecipes", () => {
  it("finds NPV for a natural-language query", () => {
    const results = searchHelpRecipes("how do I find NPV?");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.recipe.id).toBe("npv");
  });

  it("finds bond price from yield-related queries", () => {
    const results = searchHelpRecipes("bond price from yield");

    expect(results[0]?.recipe.id).toBe("bond-price");
  });

  it("finds days between dates", () => {
    const results = searchHelpRecipes("days between two dates");

    expect(results.some((result) => result.recipe.id === "delta-days")).toBe(
      true,
    );
  });

  it("returns nothing for empty query", () => {
    expect(searchHelpRecipes("")).toEqual([]);
    expect(searchHelpRecipes("   ")).toEqual([]);
  });

  it("ranks IRR above unrelated topics", () => {
    const results = searchHelpRecipes("internal rate of return");

    expect(results[0]?.recipe.id).toBe("irr");
  });
});
