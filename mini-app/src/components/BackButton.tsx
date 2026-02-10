import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';

/**
 * Manages BackButton visibility only (show/hide based on route).
 * Pages register their own onClick handlers for custom back behavior.
 * Pages without custom handlers should register navigate(-1) themselves.
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
