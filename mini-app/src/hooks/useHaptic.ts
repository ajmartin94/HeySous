import { hapticFeedback } from '@tma.js/sdk-react';

/**
 * Haptic feedback wrapper with graceful fallback outside Telegram.
 * Uses notificationOccurred('success') instead of impactOccurred('light')
 * because impactOccurred doesn't work on Android (Pitfall 3).
 */
export function useHaptic() {
  return {
    tap() {
      try {
        hapticFeedback.notificationOccurred('success');
      } catch {
        // Graceful no-op outside Telegram
      }
    },
  };
}
