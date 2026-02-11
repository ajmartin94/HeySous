import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

export function useUserRole(): { isAdmin: boolean; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/me')
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setIsAdmin(data.role === 'admin');
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
        // Default to non-admin on error (safe default)
      });
    return () => { cancelled = true; };
  }, []);

  return { isAdmin, loading };
}
