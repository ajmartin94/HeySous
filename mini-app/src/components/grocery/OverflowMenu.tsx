import { useState, useEffect, useRef, useCallback } from 'react';

interface OverflowMenuProps {
  onClearList: () => void;
}

/**
 * Three-dot overflow menu for grocery page actions.
 * Currently contains a single "Clear list" option.
 * Dropdown closes when clicking outside.
 */
export function OverflowMenu({ onClearList }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const handleClearClick = useCallback(() => {
    setOpen(false);
    onClearList();
  }, [onClearList]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="overflow-menu" ref={menuRef}>
      <button
        className="overflow-menu__trigger"
        onClick={handleToggle}
        aria-label="More options"
        aria-expanded={open}
      >
        &#8942;
      </button>
      {open && (
        <div className="overflow-menu__dropdown">
          <button
            className="overflow-menu__item overflow-menu__item--destructive"
            onClick={handleClearClick}
          >
            Clear list
          </button>
        </div>
      )}
    </div>
  );
}
