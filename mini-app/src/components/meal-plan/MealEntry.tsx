import { Sunrise, Sun, Moon, Cookie, CakeSlice, Utensils } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MealPlanEntry } from '../../hooks/useMealPlan.js';

interface MealEntryProps {
  entry: MealPlanEntry;
  onTap: (knowledgeItemId: number) => void;
}

export const MEAL_ICONS: Record<string, LucideIcon> = {
  breakfast: Sunrise,
  lunch: Sun,
  snack: Cookie,
  dinner: Moon,
  dessert: CakeSlice,
  other: Utensils,
};

export const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
  dessert: 'Dessert',
  other: 'Other',
};

export function MealEntry({ entry, onTap }: MealEntryProps) {
  const tappable = entry.hasRecipe && entry.knowledgeItemId !== null;

  function handleClick() {
    if (tappable) {
      onTap(entry.knowledgeItemId!);
    }
  }

  return (
    <div
      className={`meal-entry${tappable ? ' meal-entry--tappable' : ''}`}
      onClick={tappable ? handleClick : undefined}
    >
      <span className="meal-entry__name">{entry.recipeName}</span>
      {!entry.hasRecipe && (
        <span className="meal-entry__no-recipe">(no recipe)</span>
      )}
    </div>
  );
}
