import { useEffect, useCallback } from 'react';
import { mainButton } from '@tma.js/sdk-react';

/**
 * Manages the Telegram MainButton lifecycle.
 * Mounts on init, shows with given text, subscribes click handler, cleans up on unmount.
 */
export function useMainButton(
  text: string,
  onClick: () => void,
  enabled: boolean = true,
) {
  useEffect(() => {
    try {
      if (!mainButton.mount.isAvailable()) return;
      mainButton.mount();
      mainButton.setParams({ text, isVisible: true, isEnabled: enabled });
    } catch {
      // Graceful no-op outside Telegram
      return;
    }

    const off = mainButton.onClick(onClick);

    return () => {
      off();
      try {
        mainButton.hide();
        mainButton.unmount();
      } catch {
        // Graceful no-op
      }
    };
  }, [text, onClick, enabled]);

  const showLoader = useCallback(() => {
    try {
      mainButton.setParams({ isLoaderVisible: true });
    } catch {
      // no-op
    }
  }, []);

  const hideLoader = useCallback(() => {
    try {
      mainButton.setParams({ isLoaderVisible: false });
    } catch {
      // no-op
    }
  }, []);

  return { showLoader, hideLoader };
}
