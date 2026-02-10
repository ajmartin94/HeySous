import { useState } from 'react';
import { Check } from 'lucide-react';
import type { GroceryItem as GroceryItemType } from '../../hooks/useGroceryList.js';

interface GroceryItemProps {
  item: GroceryItemType;
  onToggle: (id: number) => void;
  isChecked?: boolean;
}

export function GroceryItem({ item, onToggle, isChecked }: GroceryItemProps) {
  const [checking, setChecking] = useState(false);

  function handleTap() {
    if (checking) return;
    setChecking(true);
    onToggle(item.id);
    // Allow animation to play before item moves to Done section
    setTimeout(() => setChecking(false), 800);
  }

  const classNames = [
    'grocery-item',
    checking ? 'grocery-item--checking' : '',
    isChecked ? 'grocery-item--checked' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames} onClick={handleTap}>
      {isChecked && (
        <Check
          size={18}
          color="var(--tg-theme-hint-color, #999)"
          style={{ marginRight: 10, flexShrink: 0 }}
        />
      )}
      <span className="grocery-item__name">{item.name}</span>
      {item.quantity && (
        <span className="grocery-item__quantity">{item.quantity}</span>
      )}
    </div>
  );
}
