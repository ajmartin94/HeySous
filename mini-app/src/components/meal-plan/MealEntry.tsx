import { Sunrise, Sun, Moon } from 'lucide-react';
import type { MealPlanEntry } from '../../hooks/useMealPlan.js';

interface MealEntryProps {
  entry: MealPlanEntry;
  onTap: (knowledgeItemId: number) => void;
}

const MEAL_ICONS = {
  breakfast: Sunrise,
  lunch: Sun,
  dinner: Moon,
} as const;

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

export function MealEntry({ entry, onTap }: MealEntryProps) {
  const Icon = MEAL_ICONS[entry.mealType];
  const label = MEAL_LABELS[entry.mealType] || entry.mealType;
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
      <span className={`meal-entry__icon meal-entry__icon--${entry.mealType}`}>
        <Icon size={16} />
      </span>
      <span className="meal-entry__label">{label}</span>
      <span className="meal-entry__name">{entry.recipeName}</span>
      {!entry.hasRecipe && (
        <span className="meal-entry__no-recipe">(no recipe)</span>
      )}
    </div>
  );
}
