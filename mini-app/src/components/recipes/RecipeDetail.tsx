import type { RecipeDetailData } from '../../hooks/useRecipes.js';
import { parseRecipeContent, computeRating } from '../../utils/recipeParser.js';

interface RecipeDetailProps {
  recipe: RecipeDetailData;
  onBack: () => void;
}

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

export function RecipeDetail({ recipe }: RecipeDetailProps) {
  const parsed = parseRecipeContent(recipe.content);
  const ratingResult = computeRating(parsed.feedback);
  const ratingLabel = ratingResult?.label;

  const displayTags = recipe.tags.filter((t) => t !== 'recipe');

  const hasMetadata =
    parsed.metadata.prepTime ||
    parsed.metadata.cookTime ||
    parsed.metadata.totalTime ||
    parsed.metadata.servings;

  return (
    <div className="recipe-detail">
      {/* Header */}
      <div className="recipe-detail__header">
        <h1 className="recipe-detail__title">{recipe.title}</h1>

        <div className="recipe-detail__meta-row">
          {recipe.lastCooked && (
            <span>{formatLastCooked(recipe.lastCooked)}</span>
          )}
          {recipe.cookCount > 0 && (
            <span>
              Cooked {recipe.cookCount} time{recipe.cookCount !== 1 ? 's' : ''}
            </span>
          )}
          {ratingLabel && (
            <span
              className={`recipe-card__rating recipe-card__rating--${ratingLabel.replace(/\s+/g, '-')}`}
            >
              {RATING_LABELS[ratingLabel] || ratingLabel}
            </span>
          )}
        </div>

        {displayTags.length > 0 && (
          <div className="tag-pills">
            {displayTags.map((tag) => (
              <span key={tag} className="tag-pill" style={{ cursor: 'default' }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Metadata grid */}
      {hasMetadata && (
        <div className="recipe-detail__section">
          <div className="recipe-detail__metadata-grid">
            {parsed.metadata.prepTime && (
              <div className="recipe-detail__metadata-item">
                <div className="recipe-detail__metadata-label">Prep Time</div>
                <div className="recipe-detail__metadata-value">
                  {parsed.metadata.prepTime}
                </div>
              </div>
            )}
            {parsed.metadata.cookTime && (
              <div className="recipe-detail__metadata-item">
                <div className="recipe-detail__metadata-label">Cook Time</div>
                <div className="recipe-detail__metadata-value">
                  {parsed.metadata.cookTime}
                </div>
              </div>
            )}
            {parsed.metadata.totalTime && (
              <div className="recipe-detail__metadata-item">
                <div className="recipe-detail__metadata-label">Total Time</div>
                <div className="recipe-detail__metadata-value">
                  {parsed.metadata.totalTime}
                </div>
              </div>
            )}
            {parsed.metadata.servings && (
              <div className="recipe-detail__metadata-item">
                <div className="recipe-detail__metadata-label">Servings</div>
                <div className="recipe-detail__metadata-value">
                  {parsed.metadata.servings}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ingredients */}
      {parsed.ingredientGroups.length > 0 && (
        <div className="recipe-detail__section">
          <h2 className="recipe-detail__section-title">Ingredients</h2>
          {parsed.ingredientGroups.map((group, gi) => (
            <div key={gi}>
              {group.heading && (
                <div className="recipe-detail__subsection-title">
                  {group.heading}
                </div>
              )}
              {group.items.map((item, ii) => (
                <div key={ii} className="recipe-detail__ingredient">
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Steps */}
      {parsed.steps.length > 0 && (
        <div className="recipe-detail__section">
          <h2 className="recipe-detail__section-title">Steps</h2>
          {parsed.steps.map((step, i) => (
            <div key={i} className="recipe-detail__step">
              <div className="recipe-detail__step-number">{i + 1}</div>
              <div className="recipe-detail__step-text">{step}</div>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {parsed.notes.length > 0 && (
        <div className="recipe-detail__section">
          <h2 className="recipe-detail__section-title">Notes</h2>
          {parsed.notes.map((note, i) => (
            <div key={i} className="recipe-detail__note">
              {note}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
