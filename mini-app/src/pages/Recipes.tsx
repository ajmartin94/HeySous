import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';
import { useRecipes } from '../hooks/useRecipes.js';
import { RecipeList } from '../components/recipes/RecipeList.js';
import { RecipeDetail } from '../components/recipes/RecipeDetail.js';
import { DeleteRecipeDialog } from '../components/recipes/DeleteRecipeDialog.js';
import { SearchHeader } from '../components/recipes/SearchHeader.js';
import { TagChipBar } from '../components/recipes/TagChipBar.js';
import { RecipeEmptyState } from '../components/recipes/RecipeEmptyState.js';
import { SkeletonCard } from '../components/SkeletonCard.js';
import { useCanGoBack } from '../hooks/useCanGoBack.js';
import { goBack } from '../utils/backNavigation.js';
import '../components/recipes/recipes.css';

export function Recipes() {
  // Read ?id query param for deep-link navigation
  const [searchParams] = useSearchParams();
  const deepLinkId = searchParams.get('id');
  const parsedId = deepLinkId ? parseInt(deepLinkId, 10) : NaN;
  const initialRecipeId = isNaN(parsedId) ? undefined : parsedId;

  const {
    recipes,
    loading,
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
  } = useRecipes(initialRecipeId);

  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const scrollPositionRef = useRef(0);

  // BackButton handler: close detail if open, otherwise navigate back.
  // Falls back to the Hub when there's no in-app history to pop to (e.g. a
  // deep link that opened straight into this recipe's detail view).
  useEffect(() => {
    if (!backButton.onClick.isAvailable()) return;

    const off = backButton.onClick(() => {
      if (selectedRecipeId !== null) {
        handleCloseDetail();
      } else {
        goBack(navigate, canGoBack);
      }
    });

    return () => {
      off();
    };
  }, [selectedRecipeId, navigate, canGoBack]);

  function handleOpenDetail(id: number) {
    scrollPositionRef.current = window.scrollY;
    openDetail(id);
  }

  function handleCloseDetail() {
    closeDetail();
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollPositionRef.current);
    });
  }

  function handleTagClick(tag: string) {
    // If already filtering by this tag, remove filter
    setActiveTag(activeTag === tag ? null : tag);
  }

  function handleToggleSearch() {
    if (isSearchOpen) {
      setSearchInput('');
    }
    setIsSearchOpen(!isSearchOpen);
  }

  // Delete recipe handler
  const handleDeleteRecipe = useCallback(async () => {
    if (selectedRecipeId === null) return;
    const success = await deleteRecipe(selectedRecipeId);
    if (success) {
      closeDetail();
      refetch();
    }
    setShowDeleteDialog(false);
  }, [selectedRecipeId, deleteRecipe, closeDetail, refetch]);

  // Detail view
  if (selectedRecipeId !== null) {
    if (detailLoading || !recipeDetail) {
      return (
        <div className="recipes-page">
          <div className="recipes-skeleton">
            <SkeletonCard lines={6} />
          </div>
        </div>
      );
    }
    return (
      <div className="recipes-page">
        <RecipeDetail
          recipe={recipeDetail}
          onBack={handleCloseDetail}
          onDelete={() => setShowDeleteDialog(true)}
        />
        <DeleteRecipeDialog
          open={showDeleteDialog}
          recipeName={recipeDetail.title}
          onCancel={() => setShowDeleteDialog(false)}
          onConfirm={handleDeleteRecipe}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="recipes-page">
      <SearchHeader
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        sortBy={sortBy}
        onSortChange={setSortBy}
        isSearchOpen={isSearchOpen}
        onToggleSearch={handleToggleSearch}
      />
      <TagChipBar activeTag={activeTag} onRemove={() => setActiveTag(null)} />

      {loading ? (
        <div className="recipes-skeleton">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} lines={3} />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <RecipeEmptyState hasRecipes={!!(searchInput || activeTag)} />
      ) : (
        <RecipeList
          recipes={recipes}
          onSelect={handleOpenDetail}
          onTagClick={handleTagClick}
        />
      )}
    </div>
  );
}
