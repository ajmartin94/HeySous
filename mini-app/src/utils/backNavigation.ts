import type { NavigateFunction } from 'react-router-dom';

/**
 * Navigate back to the previous in-app view, the way the Telegram BackButton
 * is expected to behave.
 *
 * `navigate(-1)` pops browser/SPA history -- but on a cold start (opening the
 * Mini App fresh via the menu button or a deep link) there is no in-app
 * history to pop, so it silently does nothing and strands the user on the
 * current page. When `canGoBack` is false we instead replace the current
 * entry with the Hub so the BackButton always takes the user somewhere
 * sensible.
 */
export function goBack(navigate: NavigateFunction, canGoBack: boolean): void {
  if (canGoBack) {
    navigate(-1);
  } else {
    navigate('/', { replace: true });
  }
}
