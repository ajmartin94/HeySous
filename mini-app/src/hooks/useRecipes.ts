import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../api.js";

export interface RecipeCard {
  id: number;
  title: string;
  summary: string;
  tags: string[];
  lastCooked: string | null;
  cookCount: number;
  rating?: { label: string } | null;
}

export interface RecipeDetailData {
  id: number;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  lastCooked: string | null;
  cookCount: number;
}

export type SortOption = "recent" | "alphabetical" | "most_cooked";

interface RecipesListResponse {
  recipes: RecipeCard[];
}

interface RecipeDetailResponse {
  recipe: RecipeDetailData;
}

/**
 * Data fetching hook for recipe browsing with debounced search,
 * tag filtering, sort options, and detail fetching.
 *
 * Follows the useGroceryList pattern (isMountedRef, apiFetch, loading/error).
 */
export function useRecipes(initialRecipeId?: number) {
  const [recipes, setRecipes] = useState<RecipeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state: raw input + debounced query
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Filter & sort state
  const [activeTag, setActiveTagState] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("recent");

  // Detail view state
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [recipeDetail, setRecipeDetail] = useState<RecipeDetailData | null>(
    null
  );
  const [detailLoading, setDetailLoading] = useState(false);

  // Track mounted state to prevent updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        setDebouncedQuery(searchInput);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch recipe list based on current filters
  const fetchRecipes = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (activeTag) params.set("tag", activeTag);
      params.set("sort", sortBy);

      const qs = params.toString();
      const res = await apiFetch(`/recipes${qs ? `?${qs}` : ""}`);

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data: RecipesListResponse = await res.json();

      if (isMountedRef.current) {
        setRecipes(data.recipes);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to load recipes"
        );
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [debouncedQuery, activeTag, sortBy]);

  // Re-fetch when filters change
  useEffect(() => {
    setLoading(true);
    fetchRecipes();
  }, [fetchRecipes]);

  // Fetch full recipe detail
  const fetchDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await apiFetch(`/recipes/${id}`);

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data: RecipeDetailResponse = await res.json();

      if (isMountedRef.current) {
        setRecipeDetail(data.recipe);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to load recipe detail"
        );
      }
    } finally {
      if (isMountedRef.current) {
        setDetailLoading(false);
      }
    }
  }, []);

  // Auto-open recipe detail when deep-linked via ?id query param
  useEffect(() => {
    if (initialRecipeId != null) {
      setSelectedRecipeId(initialRecipeId);
      fetchDetail(initialRecipeId);
    }
  }, [initialRecipeId, fetchDetail]);

  // Toggle tag filter: same tag = clear, different tag = set
  const setActiveTag = useCallback((tag: string | null) => {
    setActiveTagState((prev) => (prev === tag ? null : tag));
  }, []);

  // Open detail view
  const openDetail = useCallback(
    (id: number) => {
      setSelectedRecipeId(id);
      fetchDetail(id);
    },
    [fetchDetail]
  );

  // Close detail view
  const closeDetail = useCallback(() => {
    setSelectedRecipeId(null);
    setRecipeDetail(null);
  }, []);

  // Delete a recipe via API
  const deleteRecipe = useCallback(async (id: number): Promise<boolean> => {
    try {
      const res = await apiFetch(`/recipes/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  // Re-fetch the recipe list (e.g., after deletion)
  const refetch = useCallback(() => {
    setLoading(true);
    fetchRecipes();
  }, [fetchRecipes]);

  return {
    recipes,
    loading,
    error,
    searchInput,
    setSearchInput,
    activeTag,
    setActiveTag,
    sortBy,
    setSortBy,
    selectedRecipeId,
    recipeDetail,
    detailLoading,
    openDetail,
    closeDetail,
    deleteRecipe,
    refetch,
  };
}
