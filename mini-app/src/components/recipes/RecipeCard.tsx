import type { RecipeCard as RecipeCardData } from '../../hooks/useRecipes.js';

interface RecipeCardProps {
  recipe: RecipeCardData & { rating?: { label: string } | null };
  onSelect: (id: number) => void;
  onTagClick: (tag: string) => void;
}

const MAX_VISIBLE_TAGS = 3;

const RATING_LABELS: Record<string, string> = {
  favorite: 'Favorite',
  liked: 'Liked',
  mixed: 'Mixed',
  'needs work': 'Needs Work',
};

function formatLastCooked(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Cooked today';
  if (diffDays === 1) return 'Cooked yesterday';
  if (diffDays < 7) return `Cooked ${diffDays} days ago`;

  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  return `Cooked ${month} ${day}`;
}

export function RecipeCard({ recipe, onSelect, onTagClick }: RecipeCardProps) {
  const displayTags = recipe.tags.filter((t) => t !== 'recipe');
  const visibleTags = displayTags.slice(0, MAX_VISIBLE_TAGS);
  const overflowCount = displayTags.length - MAX_VISIBLE_TAGS;

  const ratingLabel = recipe.rating?.label;
  const ratingModifier = ratingLabel
    ? `recipe-card__rating--${ratingLabel.replace(/\s+/g, '-')}`
    : '';

  return (
    <div className="recipe-card" onClick={() => onSelect(recipe.id)}>
      <h3 className="recipe-card__title">{recipe.title}</h3>
      <p className="recipe-card__summary">{recipe.summary}</p>

      <div className="recipe-card__meta">
        {recipe.lastCooked && (
          <span className="recipe-card__date">
            {formatLastCooked(recipe.lastCooked)}
          </span>
        )}
        {ratingLabel && (
          <span className={`recipe-card__rating ${ratingModifier}`}>
            {RATING_LABELS[ratingLabel] || ratingLabel}
          </span>
        )}
      </div>

      {visibleTags.length > 0 && (
        <div className="tag-pills">
          {visibleTags.map((tag) => (
            <button
              key={tag}
              className="tag-pill"
              onClick={(e) => {
                e.stopPropagation();
                onTagClick(tag);
              }}
            >
              {tag}
            </button>
          ))}
          {overflowCount > 0 && (
            <span className="tag-pill tag-pill--overflow">
              +{overflowCount} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
