import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api.js';

export interface GroceryItem {
  id: number;
  listId: number;
  name: string;
  quantity: string | null;
  store: string;
  section: string;
  checked: boolean;
  createdAt: string;
}

interface GroceryListResponse {
  listId?: number;
  items: GroceryItem[];
  stores: string[];
}

/**
 * Data fetching, optimistic toggle, and state management for grocery items.
 */
export function useGroceryList() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasActiveList, setHasActiveList] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      const res = await apiFetch('/grocery');
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      const data: GroceryListResponse = await res.json();
      setItems(data.items);
      setStores(data.stores);
      setHasActiveList(!!data.listId);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load grocery list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const toggleItem = useCallback((itemId: number) => {
    // Optimistically flip the checked boolean
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item,
      ),
    );

    // Fire-and-forget API call
    apiFetch('/grocery/toggle', {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    }).catch(() => {
      // Revert on failure
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, checked: !item.checked } : item,
        ),
      );
      setError('Failed to toggle item');
      // Clear error after a brief period
      setTimeout(() => setError(null), 3000);
    });
  }, []);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchList();
  }, [fetchList]);

  return {
    items,
    stores,
    loading,
    error,
    toggleItem,
    refetch,
    hasActiveList,
  };
}
