import {
  HELP_RECIPES,
  type HelpRecipe,
} from "./help-recipes";

export type HelpSearchResult = {
  recipe: HelpRecipe;
  score: number;
};

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s%]/g, " ")
    .replace(/\s+/g, " ");
}

function tokenize(query: string): string[] {
  return normalizeText(query)
    .split(" ")
    .filter((token) => token.length >= 2);
}

function scoreRecipe(recipe: HelpRecipe, query: string): number {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return 0;
  }

  let score = 0;
  const title = normalizeText(recipe.title);
  const summary = normalizeText(recipe.summary);
  const tokens = tokenize(query);

  if (title === normalizedQuery) {
    score += 120;
  } else if (title.includes(normalizedQuery)) {
    score += 60;
  }

  for (const keyword of recipe.keywords) {
    const normalizedKeyword = normalizeText(keyword);

    if (normalizedKeyword === normalizedQuery) {
      score += 100;
    } else if (normalizedKeyword.includes(normalizedQuery)) {
      score += 55;
    } else if (normalizedQuery.includes(normalizedKeyword)) {
      score += 45;
    }
  }

  if (summary.includes(normalizedQuery)) {
    score += 25;
  }

  for (const token of tokens) {
    if (title.includes(token)) {
      score += 12;
    }

    if (summary.includes(token)) {
      score += 6;
    }

    for (const keyword of recipe.keywords) {
      if (normalizeText(keyword).includes(token)) {
        score += 10;
      }
    }

    for (const step of recipe.steps) {
      if (normalizeText(step).includes(token)) {
        score += 3;
      }
    }
  }

  return score;
}

/** Rank help recipes by keyword overlap with a natural-language query. */
export function searchHelpRecipes(
  query: string,
  limit = 5,
): HelpSearchResult[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return [];
  }

  return HELP_RECIPES.map((recipe) => ({
    recipe,
    score: scoreRecipe(recipe, query),
  }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title))
    .slice(0, limit);
}
