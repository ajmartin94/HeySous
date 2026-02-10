import { useState, useEffect, useCallback, useRef } from 'react';
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
 * Data fetching, optimistic toggle, add item, complete list,
 * and optional polling sync for grocery items.
 */
export function useGroceryList(pollInterval: number = 0) {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasActiveList, setHasActiveList] = useState(false);
  const isMountedRef = useRef(true);

  const fetchList = useCallback(async () => {
    try {
      const res = await apiFetch('/grocery');
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      const data: GroceryListResponse = await res.json();
      if (isMountedRef.current) {
        setItems(data.items);
        setStores(data.stores);
        setHasActiveList(!!data.listId);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load grocery list');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Polling: refetch at given interval when pollInterval > 0
  useEffect(() => {
    if (pollInterval <= 0) return;

    const id = setInterval(() => {
      fetchList();
    }, pollInterval);

    return () => clearInterval(id);
  }, [pollInterval, fetchList]);

  // Visibility change: refetch when user switches back to Mini App
  useEffect(() => {
    if (pollInterval <= 0) return;

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        fetchList();
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pollInterval, fetchList]);

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
      setTimeout(() => setError(null), 3000);
    });
  }, []);

  const addItem = useCallback(
    async (name: string, quantity: string | undefined, store: string): Promise<void> => {
      const res = await apiFetch('/grocery/add', {
        method: 'POST',
        body: JSON.stringify({ name, quantity, store, section: undefined }),
      });
      if (!res.ok) {
        const msg = `Failed to add item: ${res.status}`;
        setError(msg);
        setTimeout(() => setError(null), 3000);
        throw new Error(msg);
      }
      const data: { items: GroceryItem[] } = await res.json();
      if (isMountedRef.current) {
        setItems(data.items);
      }
    },
    [],
  );

  const completeList = useCallback(async (): Promise<boolean> => {
    try {
      const res = await apiFetch('/grocery/complete', {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      return true;
    } catch {
      setError('Failed to complete list');
      setTimeout(() => setError(null), 3000);
      return false;
    }
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
    addItem,
    completeList,
  };
}
