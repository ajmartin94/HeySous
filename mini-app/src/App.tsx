import { AppRoot } from '@telegram-apps/telegram-ui';
import '@telegram-apps/telegram-ui/dist/styles.css';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ThemeProvider, useTheme } from './theme/ThemeContext.js';

function AppShell() {
  const { theme } = useTheme();
  return (
    <AppRoot appearance={theme}>
      <RouterProvider router={router} />
    </AppRoot>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
