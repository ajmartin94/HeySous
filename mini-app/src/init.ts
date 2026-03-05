import {
  init,
  miniApp,
  themeParams,
  viewport,
  swipeBehavior,
  backButton,
} from '@tma.js/sdk-react';

export async function initializeTelegramSDK(): Promise<void> {
  // 1. Initialize the SDK (must be first)
  init();

  // 2. Mount theme params and mini app
  themeParams.mount();
  miniApp.mount();

  // 3. Bind CSS variables for theming
  themeParams.bindCssVars();
  miniApp.bindCssVars();

  // 4. Mount and configure viewport (async)
  await viewport.mount();
  viewport.bindCssVars();

  // 5. Expand to full height and request fullscreen on supported clients (iPad)
  viewport.expand();
  if (viewport.requestFullscreen.isAvailable()) {
    viewport.requestFullscreen().catch(() => {
      // Fullscreen not supported or denied -- fall back to expanded mode
    });
  }

  // 6. Disable vertical swipes (iOS scroll collapse fix)
  if (swipeBehavior.mount.isAvailable()) {
    swipeBehavior.mount();
    swipeBehavior.disableVertical();
  }

  // 7. Mount back button for navigation
  backButton.mount();

  // 8. Signal ready (hides loading placeholder)
  miniApp.ready();
}
