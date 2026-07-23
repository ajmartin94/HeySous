import { useOutletContext } from 'react-router-dom';

/**
 * Context shape provided by Layout via <Outlet context={...} /> so nested
 * pages can tell whether there is any in-app navigation history to pop to.
 */
export interface LayoutOutletContext {
  canGoBack: boolean;
}

/**
 * Whether the user has navigated in-app at least once since this session
 * started (i.e. there is a previous in-app route `navigate(-1)` can safely
 * return to). False on cold start -- including deep-link entry straight into
 * a section -- since there is nothing behind the current view.
 *
 * Falls back to `false` if used outside of the Layout's Outlet (defensive;
 * should not happen in practice since all routes are Layout's children).
 */
export function useCanGoBack(): boolean {
  const ctx = useOutletContext<LayoutOutletContext | undefined>();
  return ctx?.canGoBack ?? false;
}
