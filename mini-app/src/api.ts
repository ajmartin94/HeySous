import { retrieveRawInitData } from '@tma.js/sdk-react';

// Store initDataRaw at module level ONCE at startup.
// Pitfall 3: window.location.hash may be overwritten by React Router,
// so raw init data must be retrieved before routing initializes.
let initDataRaw: string | undefined;
try {
  initDataRaw = retrieveRawInitData() as string | undefined;
} catch {
  // Not running inside Telegram -- initDataRaw stays undefined
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
      'X-Init-Data': initDataRaw ?? '',
    },
  });
}
