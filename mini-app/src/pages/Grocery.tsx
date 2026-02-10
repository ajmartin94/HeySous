import { useState, useEffect, useMemo } from 'react';
import { StoreTabs } from '../components/grocery/StoreTabs.js';
import { SectionGroup } from '../components/grocery/SectionGroup.js';
import { DoneSection } from '../components/grocery/DoneSection.js';
import { ProgressBar } from '../components/grocery/ProgressBar.js';
import { EmptyState } from '../components/grocery/EmptyState.js';
import { useGroceryList } from '../hooks/useGroceryList.js';
import { useHaptic } from '../hooks/useHaptic.js';
import { sectionSortKey } from '../utils/sectionMap.js';
import '../components/grocery/grocery.css';

export function Grocery() {
  const { items, stores, loading, hasActiveList, toggleItem } =
    useGroceryList();
  const haptic = useHaptic();
  const [activeStore, setActiveStore] = useState('');

  // Set activeStore to first store when stores arrive
  useEffect(() => {
    if (stores.length > 0 && !activeStore) {
      setActiveStore(stores[0]);
    }
  }, [stores, activeStore]);

  // Filter items to active store
  const storeItems = useMemo(
    () => items.filter((item) => item.store === activeStore),
    [items, activeStore],
  );

  // Group unchecked items by section, sorted by aisle order
  const sections = useMemo(() => {
    const groups = new Map<string, typeof storeItems>();
    for (const item of storeItems) {
      if (item.checked) continue;
      const existing = groups.get(item.section) || [];
      existing.push(item);
      groups.set(item.section, existing);
    }
    return [...groups.entries()].sort(
      ([a], [b]) => sectionSortKey(a) - sectionSortKey(b),
    );
  }, [storeItems]);

  // Checked items for current store (done section)
  const checkedItems = useMemo(
    () => storeItems.filter((item) => item.checked),
    [storeItems],
  );

  // Global progress (all items, not just current store)
  const totalItems = items.length;
  const checkedCount = items.filter((item) => item.checked).length;

  function handleToggle(itemId: number) {
    haptic.tap();
    toggleItem(itemId);
  }

  if (loading) {
    return (
      <div className="grocery-page">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            color: 'var(--tg-theme-hint-color, #999)',
          }}
        >
          Loading...
        </div>
      </div>
    );
  }

  if (!hasActiveList) {
    return (
      <div className="grocery-page">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="grocery-page">
      <StoreTabs
        stores={stores}
        activeStore={activeStore}
        onStoreChange={setActiveStore}
      />
      <ProgressBar checked={checkedCount} total={totalItems} />
      {sections.map(([section, sectionItems]) => (
        <SectionGroup
          key={section}
          section={section}
          items={sectionItems}
          onToggle={handleToggle}
        />
      ))}
      <DoneSection items={checkedItems} onToggle={handleToggle} />
    </div>
  );
}
