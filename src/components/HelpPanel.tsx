"use client";

import { useMemo, useState } from "react";
import {
  HELP_FEATURED_IDS,
  RPN_BASICS,
  getHelpRecipeById,
  type HelpRecipe,
} from "@/lib/help-recipes";
import { searchHelpRecipes } from "@/lib/help-search";

function HelpRecipeCard({ recipe }: { recipe: HelpRecipe }) {
  return (
    <article className="rounded border border-[#d0d8da] bg-[#f4f7f8] px-4 py-3">
      <h3 className="text-sm font-semibold text-[#222]">{recipe.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-[#555]">{recipe.summary}</p>
      <ol className="mt-2.5 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-[#333]">
        {recipe.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </article>
  );
}

function RpnBasicsCard() {
  return (
    <article className="rounded border border-[#d0d8da] bg-[#eef2f3] px-4 py-3">
      <h3 className="text-sm font-semibold text-[#222]">{RPN_BASICS.title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-[#555]">{RPN_BASICS.summary}</p>
      <ul className="mt-2.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-[#333]">
        {RPN_BASICS.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
    </article>
  );
}

function PopularTopics({
  onSelect,
}: {
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-xs text-[#666]">Popular topics</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {HELP_FEATURED_IDS.map((id) => {
          const recipe = getHelpRecipeById(id);
          if (!recipe) {
            return null;
          }

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className="rounded-full border border-[#d0d8da] bg-white px-3 py-1 text-xs font-medium text-[#444] transition hover:border-[#88949a] hover:bg-[#f4f7f8]"
            >
              {recipe.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function HelpPanel() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const results = useMemo(() => searchHelpRecipes(query), [query]);

  const selectedRecipe =
    selectedId !== null ? getHelpRecipeById(selectedId) : undefined;

  const isHome = !query.trim() && !selectedRecipe;
  const isEmptySearch = query.trim().length > 0 && results.length === 0;

  const visibleRecipes = query.trim()
    ? results.map((result) => result.recipe)
    : selectedRecipe
      ? [selectedRecipe]
      : [];

  function returnToHome() {
    setQuery("");
    setSelectedId(null);
  }

  function selectTopic(id: string) {
    setQuery("");
    setSelectedId(id);
  }

  return (
    <section
      aria-label="Help"
      className="flex h-full min-h-0 w-full flex-col rounded-sm border border-[#d8d6d0] bg-white shadow-sm"
    >
      <div className="shrink-0 border-b border-[#eceae4] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-[#222]">Help</h2>
            <p className="mt-0.5 text-xs text-[#666]">
              Financial &amp; calendar functions — keystroke recipes, not AI.
            </p>
          </div>
          {!isHome ? (
            <button
              type="button"
              onClick={returnToHome}
              className="shrink-0 rounded border border-[#ccc] px-3 py-1.5 text-xs font-medium text-[#333] transition hover:border-[#88949a] hover:bg-[#f4f7f8]"
            >
              ← All topics
            </button>
          ) : null}
        </div>
        <label className="mt-3 block">
          <span className="sr-only">Search help</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedId(null);
            }}
            placeholder="Try: NPV, bond price, DATE…"
            className="w-full rounded border border-[#ccc] bg-white px-3 py-2 text-sm text-[#222] outline-none ring-[#88949a] placeholder:text-[#999] focus:ring-2"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {isHome ? (
          <>
            <RpnBasicsCard />
            <PopularTopics onSelect={selectTopic} />
          </>
        ) : null}

        {isEmptySearch ? (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-[#666]">
              This help covers financial and calendar functions — not basic
              arithmetic or a full RPN tutorial. Choose All topics for RPN
              basics, or try one below.
            </p>
            <PopularTopics onSelect={selectTopic} />
          </div>
        ) : null}

        {visibleRecipes.length > 0 ? (
          <div className="space-y-3">
            {visibleRecipes.map((recipe) => (
              <HelpRecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
