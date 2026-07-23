import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';

/**
 * Manages BackButton visibility only (show/hide based on route).
 * Pages register their own onClick handlers for custom back behavior --
 * use `goBack()` from `utils/backNavigation.ts` (with `useCanGoBack()`) so
 * the button never strands the user when there's no in-app history to pop
 * (e.g. cold start / deep-link entry straight into a section).
 */
export function useBackButton() {
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '';

  useEffect(() => {
    if (!backButton.hide.isAvailable()) return;

    if (isHome) {
      backButton.hide();
    } else {
      backButton.show();
    }
  }, [isHome]);
}
