import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';

export function useBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  // With basename='/app', React Router strips the prefix.
  // Hub is at pathname '/' within the router context.
  const isHome = location.pathname === '/' || location.pathname === '';

  useEffect(() => {
    if (!backButton.hide.isAvailable()) return;

    if (isHome) {
      backButton.hide();
    } else {
      backButton.show();
    }

    const off = backButton.onClick(() => {
      navigate(-1);
    });

    return () => {
      off();
    };
  }, [isHome, navigate]);
}
