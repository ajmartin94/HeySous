import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';
import { useRecipes } from '../hooks/useRecipes.js';
import { RecipeList } from '../components/recipes/RecipeList.js';
import { RecipeDetail } from '../components/recipes/RecipeDetail.js';
import { SearchHeader } from '../components/recipes/SearchHeader.js';
import { TagChipBar } from '../components/recipes/TagChipBar.js';
import { RecipeEmptyState } from '../components/recipes/RecipeEmptyState.js';
import { SkeletonCard } from '../components/SkeletonCard.js';
import '../components/recipes/recipes.css';

export function Recipes() {
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
  } = useRecipes();

  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const scrollPositionRef = useRef(0);

  // BackButton handler: close detail if open, otherwise navigate back
  useEffect(() => {
    if (!backButton.onClick.isAvailable()) return;

    const off = backButton.onClick(() => {
      if (selectedRecipeId !== null) {
        handleCloseDetail();
      } else {
        navigate(-1);
      }
    });

    return () => {
      off();
    };
  }, [selectedRecipeId, navigate]);

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
        <RecipeDetail recipe={recipeDetail} onBack={handleCloseDetail} />
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
