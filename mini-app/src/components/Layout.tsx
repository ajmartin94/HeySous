import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { useBackButton } from './BackButton';
import type { LayoutOutletContext } from '../hooks/useCanGoBack.js';
import './Layout.css';

export function Layout() {
  useBackButton();

  // Track whether there is any in-app navigation history to go back to.
  // PUSH deepens the stack, POP (browser/BackButton back) shallows it;
  // REPLACE leaves it unchanged. This lets pages distinguish "the user
  // navigated here from elsewhere in the app" (safe to navigate(-1)) from
  // "this is a cold start / deep-link entry" (nothing to pop to -- the
  // BackButton should fall back to the Hub instead of doing nothing).
  const location = useLocation();
  const navigationType = useNavigationType();
  const navDepthRef = useRef(0);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    if (navigationType === 'PUSH') {
      navDepthRef.current += 1;
    } else if (navigationType === 'POP') {
      navDepthRef.current = Math.max(0, navDepthRef.current - 1);
    }
    setCanGoBack(navDepthRef.current > 0);
    // Only the navigation itself (identified by location.key) should
    // re-evaluate depth; navigationType is derived from the same transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const outletContext: LayoutOutletContext = { canGoBack };

  return (
    <div
      className="layout-root"
      style={{
        paddingTop: 'calc(var(--tg-content-safe-area-inset-top, 16px) + var(--tg-safe-area-inset-top, 56px))',
        paddingBottom: 'var(--tg-viewport-content-safe-area-inset-bottom, 0px)',
      }}
    >
      <Outlet context={outletContext} />
    </div>
  );
}
