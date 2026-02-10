import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { GroceryItem } from './GroceryItem.js';
import type { GroceryItem as GroceryItemType } from '../../hooks/useGroceryList.js';

interface DoneSectionProps {
  items: GroceryItemType[];
  onToggle: (id: number) => void;
}

export function DoneSection({ items, onToggle }: DoneSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="done-section">
      <div
        className="done-section__header"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <ChevronDown
          size={16}
          className={`done-section__chevron${expanded ? ' done-section__chevron--open' : ''}`}
        />
        Done ({items.length})
      </div>
      {expanded &&
        items.map((item) => (
          <GroceryItem
            key={item.id}
            item={item}
            onToggle={onToggle}
            isChecked
          />
        ))}
    </div>
  );
}
