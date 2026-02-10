import { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronDown, Check } from 'lucide-react';
import type { SortOption } from '../../hooks/useRecipes.js';

interface SearchHeaderProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
}

const SORT_LABELS: Record<SortOption, string> = {
  recent: 'Recent',
  alphabetical: 'A-Z',
  most_cooked: 'Most Cooked',
};

const SORT_OPTIONS: SortOption[] = ['recent', 'alphabetical', 'most_cooked'];

export function SearchHeader({
  searchInput,
  onSearchChange,
  sortBy,
  onSortChange,
  isSearchOpen,
  onToggleSearch,
}: SearchHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the search input when opened
  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;

    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [dropdownOpen]);

  function handleSortSelect(option: SortOption) {
    onSortChange(option);
    setDropdownOpen(false);
  }

  return (
    <div className="search-header">
      {isSearchOpen ? (
        <div className="search-header__input-row">
          <input
            ref={inputRef}
            className="search-header__input"
            type="text"
            placeholder="Search recipes..."
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <button className="search-header__icon-btn" onClick={onToggleSearch}>
            <X size={20} />
          </button>
        </div>
      ) : (
        <>
          <span className="search-header__title">Recipes</span>
          <button className="search-header__icon-btn" onClick={onToggleSearch}>
            <Search size={20} />
          </button>
        </>
      )}

      <div className="sort-picker" ref={dropdownRef}>
        <button
          className="sort-picker__trigger"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          {SORT_LABELS[sortBy]}
          <ChevronDown size={14} />
        </button>

        {dropdownOpen && (
          <div className="sort-picker__dropdown">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option}
                className={`sort-picker__option ${
                  option === sortBy ? 'sort-picker__option--active' : ''
                }`}
                onClick={() => handleSortSelect(option)}
              >
                {SORT_LABELS[option]}
                {option === sortBy && <Check size={16} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
