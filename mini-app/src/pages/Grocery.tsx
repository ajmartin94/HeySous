import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';
import { useCanGoBack } from '../hooks/useCanGoBack.js';
import { goBack } from '../utils/backNavigation.js';
import { StoreTabs } from '../components/grocery/StoreTabs.js';
import { SectionGroup } from '../components/grocery/SectionGroup.js';
import { DoneSection } from '../components/grocery/DoneSection.js';
import { ProgressBar } from '../components/grocery/ProgressBar.js';
import { EmptyState } from '../components/grocery/EmptyState.js';
import { QuickAddFab } from '../components/grocery/QuickAddFab.js';
import { OverflowMenu } from '../components/grocery/OverflowMenu.js';
import { ClearListDialog } from '../components/grocery/ClearListDialog.js';
import { useGroceryList } from '../hooks/useGroceryList.js';
import { useHaptic } from '../hooks/useHaptic.js';
import { sectionSortKey } from '../utils/sectionMap.js';
import '../components/grocery/grocery.css';

export function Grocery() {
  const { items, stores, loading, hasActiveList, toggleItem, addItem, completeList, refetch } =
    useGroceryList(hasActiveListFlag() ? 8000 : 0);
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const haptic = useHaptic();
  const [activeStore, setActiveStore] = useState('');
  const [showClearDialog, setShowClearDialog] = useState(false);

  // BackButton: navigate back, falling back to the Hub if there is no
  // in-app history to pop to (e.g. cold start / deep-link entry).
  useEffect(() => {
    if (!backButton.onClick.isAvailable()) return;
    const off = backButton.onClick(() => goBack(navigate, canGoBack));
    return () => { off(); };
  }, [navigate, canGoBack]);

  // We need a local piece of state to track hasActiveList for the poll interval.
  // Since hooks cannot be called conditionally, we manage pollInterval via a
  // wrapper approach. The useGroceryList hook receives pollInterval at call time.
  // However, to avoid a dependency cycle (pollInterval depends on hasActiveList
  // which comes from the hook), we use a simpler approach: always poll when
  // the page is mounted, and let the hook handle the enable/disable internally.
  // Actually, the simplest correct approach: pass a fixed pollInterval and
  // let the hook always poll. The overhead of an empty GET every 8s is minimal.

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

  // Clear list handler (replaces old Done Shopping MainButton)
  const handleClearList = useCallback(async () => {
    const success = await completeList();
    if (success) {
      refetch();
    }
    setShowClearDialog(false);
  }, [completeList, refetch]);

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
      <div className="grocery-page__header-bar">
        <OverflowMenu onClearList={() => setShowClearDialog(true)} />
      </div>
      {sections.map(([section, sectionItems]) => (
        <SectionGroup
          key={section}
          section={section}
          items={sectionItems}
          onToggle={handleToggle}
        />
      ))}
      <DoneSection items={checkedItems} onToggle={handleToggle} />
      <QuickAddFab activeStore={activeStore} onAdd={addItem} />
      <ClearListDialog
        open={showClearDialog}
        onCancel={() => setShowClearDialog(false)}
        onConfirm={handleClearList}
      />
    </div>
  );
}

/**
 * Helper that's used as the default poll interval check.
 * Returns true by default since we want to poll whenever the page is mounted.
 * The hook handles the case where there's no active list gracefully.
 */
function hasActiveListFlag(): boolean {
  return true;
}
