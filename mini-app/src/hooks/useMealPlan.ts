import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../api.js";
import type { RecipeDetailData } from "./useRecipes.js";

export interface MealPlanEntry {
  id: number;
  dayOfWeek: number;
  mealType: "breakfast" | "lunch" | "dinner";
  recipeName: string;
  knowledgeItemId: number | null;
  hasRecipe: boolean;
}

export interface MealPlanWeek {
  weekStartDate: string;
  entries: MealPlanEntry[];
}

interface MealPlanResponse {
  weekStartDate: string;
  entries: MealPlanEntry[];
}

interface RecipeDetailResponse {
  recipe: RecipeDetailData;
}

/**
 * Data fetching hook for meal plan with week navigation and recipe detail drill-down.
 *
 * Fetches both current and next week on mount for instant switching.
 * Follows the useRecipes pattern (isMountedRef, apiFetch, loading/error).
 */
export function useMealPlan() {
  const [currentWeek, setCurrentWeek] = useState<MealPlanWeek | null>(null);
  const [nextWeek, setNextWeek] = useState<MealPlanWeek | null>(null);
  const [activeWeekIndex, setActiveWeekIndex] = useState(0); // 0=current, 1=next
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Recipe detail drill-down state
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

  // Fetch both weeks on mount
  useEffect(() => {
    async function fetchWeeks() {
      try {
        const [currentRes, nextRes] = await Promise.all([
          apiFetch("/meal-plan?week=current"),
          apiFetch("/meal-plan?week=next"),
        ]);

        if (!currentRes.ok || !nextRes.ok) {
          throw new Error(
            `API error: ${!currentRes.ok ? currentRes.status : nextRes.status}`
          );
        }

        const currentData: MealPlanResponse = await currentRes.json();
        const nextData: MealPlanResponse = await nextRes.json();

        if (isMountedRef.current) {
          setCurrentWeek(currentData);
          setNextWeek(nextData);
          setError(null);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(
            err instanceof Error ? err.message : "Failed to load meal plan"
          );
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    }

    fetchWeeks();
  }, []);

  // Open recipe detail (only when entry hasRecipe is true)
  const openDetail = useCallback(async (id: number) => {
    setSelectedRecipeId(id);
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

  // Close recipe detail
  const closeDetail = useCallback(() => {
    setSelectedRecipeId(null);
    setRecipeDetail(null);
  }, []);

  // Computed: active week based on index
  const activeWeek = activeWeekIndex === 0 ? currentWeek : nextWeek;

  return {
    currentWeek,
    nextWeek,
    activeWeek,
    activeWeekIndex,
    setActiveWeekIndex,
    loading,
    error,
    selectedRecipeId,
    recipeDetail,
    detailLoading,
    openDetail,
    closeDetail,
  };
}
