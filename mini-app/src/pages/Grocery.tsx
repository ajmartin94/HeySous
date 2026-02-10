import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';
import { closingBehavior, miniApp, mainButton } from '@tma.js/sdk-react';
import { StoreTabs } from '../components/grocery/StoreTabs.js';
import { SectionGroup } from '../components/grocery/SectionGroup.js';
import { DoneSection } from '../components/grocery/DoneSection.js';
import { ProgressBar } from '../components/grocery/ProgressBar.js';
import { EmptyState } from '../components/grocery/EmptyState.js';
import { QuickAddFab } from '../components/grocery/QuickAddFab.js';
import { useGroceryList } from '../hooks/useGroceryList.js';
import { useHaptic } from '../hooks/useHaptic.js';
import { useMainButton } from '../hooks/useMainButton.js';
import { sectionSortKey } from '../utils/sectionMap.js';
import '../components/grocery/grocery.css';

export function Grocery() {
  const { items, stores, loading, hasActiveList, toggleItem, addItem, completeList, refetch } =
    useGroceryList(hasActiveListFlag() ? 8000 : 0);
  const navigate = useNavigate();
  const haptic = useHaptic();
  const [activeStore, setActiveStore] = useState('');

  // BackButton: navigate back to hub
  useEffect(() => {
    if (!backButton.onClick.isAvailable()) return;
    const off = backButton.onClick(() => navigate(-1));
    return () => { off(); };
  }, [navigate]);

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

  // MainButton "Done Shopping" handler
  const handleDoneShopping = useCallback(async () => {
    try {
      mainButton.setParams({ isLoaderVisible: true });
    } catch {
      // no-op
    }
    const success = await completeList();
    if (success) {
      try {
        closingBehavior.disableConfirmation();
      } catch {
        // no-op outside Telegram
      }
      try {
        miniApp.close();
      } catch {
        // Not in Telegram env -- just refetch to show empty state
        refetch();
      }
    }
  }, [completeList, refetch]);

  // MainButton integration
  useMainButton('Done Shopping', handleDoneShopping, hasActiveList);

  // ClosingBehavior: prevent accidental close during shopping
  useEffect(() => {
    if (!hasActiveList) return;

    try {
      if (closingBehavior.mount.isAvailable()) {
        closingBehavior.mount();
        closingBehavior.enableConfirmation();
      }
    } catch {
      // Graceful no-op outside Telegram
    }

    return () => {
      try {
        closingBehavior.disableConfirmation();
        closingBehavior.unmount();
      } catch {
        // Graceful no-op
      }
    };
  }, [hasActiveList]);

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
      <QuickAddFab activeStore={activeStore} onAdd={addItem} />
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
