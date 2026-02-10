import { GroceryItem } from './GroceryItem.js';
import type { GroceryItem as GroceryItemType } from '../../hooks/useGroceryList.js';

interface SectionGroupProps {
  section: string;
  items: GroceryItemType[];
  onToggle: (id: number) => void;
}

export function SectionGroup({ section, items, onToggle }: SectionGroupProps) {
  // Filter to only unchecked items -- section hides when all checked
  const uncheckedItems = items.filter((item) => !item.checked);
  if (uncheckedItems.length === 0) return null;

  return (
    <div>
      <div className="section-header">
        {section} ({uncheckedItems.length})
      </div>
      {uncheckedItems.map((item) => (
        <GroceryItem key={item.id} item={item} onToggle={onToggle} />
      ))}
    </div>
  );
}
