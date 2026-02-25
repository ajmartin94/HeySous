import { AppRoot } from '@telegram-apps/telegram-ui';
import '@telegram-apps/telegram-ui/dist/styles.css';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ThemeProvider } from './theme/ThemeContext';

export function App() {
  return (
    <ThemeProvider>
      <AppRoot>
        <RouterProvider router={router} />
      </AppRoot>
    </ThemeProvider>
  );
}
