import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../api';

// -- Types matching API response shapes from admin routes --

export interface ActivityEvent {
  id: number;
  eventType: string;
  userId: string;
  userName: string;
  timestamp: number;
  details: Record<string, unknown>;
}

export interface StatsData {
  summary: {
    messagesCount: number;
    activeUsers: number;
    apiCalls: number;
    totalUsers: number;
    totalRecipes: number;
  };
  daily: Array<{ day: string; messageCount: number }>;
}

export interface CostsData {
  totalCost: number;
  dailyBudgetTokens: number;
  byModel: Array<{ model: string; cost: number; tokens: number }>;
  byUser: Array<{ userId: string; userName: string; cost: number }>;
  daily: Array<{ day: string; cost: number }>;
}

export interface FeedbackEntry {
  id: number;
  userId: string;
  userName: string;
  text: string;
  source: string;
  timestamp: number;
}

export type TimeRange = 'today' | '7d' | '30d';

interface ActivityState {
  events: ActivityEvent[];
  hasMore: boolean;
  loading: boolean;
  error: string | null;
}

interface StatsState {
  data: StatsData | null;
  loading: boolean;
  error: string | null;
}

interface CostsState {
  data: CostsData | null;
  loading: boolean;
  error: string | null;
}

interface FeedbackState {
  entries: FeedbackEntry[];
  total: number;
  recentCount: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
}

interface ActivityFilter {
  type: string;
  userId: string;
}

const PAGE_SIZE = 50;

export function useAdminData() {
  const [range, setRangeState] = useState<TimeRange>('today');
  const [activityFilter, setActivityFilterState] = useState<ActivityFilter>({ type: 'all', userId: 'all' });

  const [activity, setActivity] = useState<ActivityState>({
    events: [],
    hasMore: false,
    loading: true,
    error: null,
  });

  const [stats, setStats] = useState<StatsState>({
    data: null,
    loading: true,
    error: null,
  });

  const [costs, setCosts] = useState<CostsState>({
    data: null,
    loading: true,
    error: null,
  });

  const [feedback, setFeedback] = useState<FeedbackState>({
    entries: [],
    total: 0,
    recentCount: 0,
    hasMore: false,
    loading: true,
    error: null,
  });

  const activityOffsetRef = useRef(0);
  const feedbackOffsetRef = useRef(0);

  // -- Fetch helpers --

  const fetchActivity = useCallback(async (filter: ActivityFilter, append = false) => {
    const offset = append ? activityOffsetRef.current : 0;
    if (!append) {
      activityOffsetRef.current = 0;
      setActivity((prev) => ({ ...prev, loading: true, error: null }));
    }

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        type: filter.type,
        userId: filter.userId,
      });
      const res = await apiFetch(`/admin/activity?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setActivity((prev) => ({
        events: append ? [...prev.events, ...data.events] : data.events,
        hasMore: data.hasMore,
        loading: false,
        error: null,
      }));
      activityOffsetRef.current = offset + data.events.length;
    } catch (err) {
      setActivity((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load activity',
      }));
    }
  }, []);

  const fetchStats = useCallback(async (r: TimeRange) => {
    setStats((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await apiFetch(`/admin/stats?range=${r}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats({ data, loading: false, error: null });
    } catch (err) {
      setStats((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load stats',
      }));
    }
  }, []);

  const fetchCosts = useCallback(async (r: TimeRange) => {
    setCosts((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await apiFetch(`/admin/costs?range=${r}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCosts({ data, loading: false, error: null });
    } catch (err) {
      setCosts((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load costs',
      }));
    }
  }, []);

  const fetchFeedback = useCallback(async (append = false) => {
    const offset = append ? feedbackOffsetRef.current : 0;
    if (!append) {
      feedbackOffsetRef.current = 0;
      setFeedback((prev) => ({ ...prev, loading: true, error: null }));
    }

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const res = await apiFetch(`/admin/feedback?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setFeedback((prev) => ({
        entries: append ? [...prev.entries, ...data.entries] : data.entries,
        total: data.total,
        recentCount: data.recentCount,
        hasMore: data.hasMore,
        loading: false,
        error: null,
      }));
      feedbackOffsetRef.current = offset + data.entries.length;
    } catch (err) {
      setFeedback((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load feedback',
      }));
    }
  }, []);

  // -- Public actions --

  const setRange = useCallback((newRange: TimeRange) => {
    setRangeState(newRange);
    fetchStats(newRange);
    fetchCosts(newRange);
  }, [fetchStats, fetchCosts]);

  const setActivityFilter = useCallback((filter: ActivityFilter) => {
    setActivityFilterState(filter);
    fetchActivity(filter);
  }, [fetchActivity]);

  const loadMoreActivity = useCallback(() => {
    fetchActivity(activityFilter, true);
  }, [fetchActivity, activityFilter]);

  const loadMoreFeedback = useCallback(() => {
    fetchFeedback(true);
  }, [fetchFeedback]);

  const refresh = useCallback(() => {
    fetchActivity(activityFilter);
    fetchStats(range);
    fetchCosts(range);
    fetchFeedback();
  }, [fetchActivity, fetchStats, fetchCosts, fetchFeedback, activityFilter, range]);

  // -- Initial fetch on mount --

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      await Promise.all([
        fetchActivity({ type: 'all', userId: 'all' }),
        fetchStats('today'),
        fetchCosts('today'),
        fetchFeedback(),
      ]);
    };

    if (!cancelled) {
      load();
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    activity,
    stats,
    costs,
    feedback,
    range,
    setRange,
    activityFilter,
    setActivityFilter,
    loadMoreActivity,
    loadMoreFeedback,
    refresh,
  };
}
