import type { RecipeCard as RecipeCardData } from '../../hooks/useRecipes.js';
import { RecipeCard } from './RecipeCard.js';

interface RecipeListProps {
  recipes: (RecipeCardData & { rating?: { label: string } | null })[];
  onSelect: (id: number) => void;
  onTagClick: (tag: string) => void;
}

export function RecipeList({ recipes, onSelect, onTagClick }: RecipeListProps) {
  if (recipes.length === 0) return null;

  return (
    <div>
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          onSelect={onSelect}
          onTagClick={onTagClick}
        />
      ))}
    </div>
  );
}
