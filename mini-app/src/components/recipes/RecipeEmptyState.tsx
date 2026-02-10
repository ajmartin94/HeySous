import { CookingPot, Search } from 'lucide-react';
import { colors } from '../../theme/tokens.js';

interface RecipeEmptyStateProps {
  /** true = filters are active but no results; false = zero recipes in collection */
  hasRecipes: boolean;
}

export function RecipeEmptyState({ hasRecipes }: RecipeEmptyStateProps) {
  if (hasRecipes) {
    return (
      <div className="recipes-empty">
        <Search size={48} color="var(--tg-theme-hint-color, #999)" />
        <h2 style={{ margin: '16px 0 8px', fontSize: '18px' }}>No recipes found</h2>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.4 }}>
          Try a different search term or clear your filters
        </p>
      </div>
    );
  }

  return (
    <div className="recipes-empty">
      <CookingPot size={48} color={colors.accent} />
      <h2 style={{ margin: '16px 0 8px', fontSize: '18px' }}>No recipes yet</h2>
      <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.4 }}>
        Tell me about a recipe in the chat to get started!
      </p>
    </div>
  );
}
