import { AppRoot } from '@telegram-apps/telegram-ui';
import '@telegram-apps/telegram-ui/dist/styles.css';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

export function App() {
  return (
    <AppRoot>
      <RouterProvider router={router} />
    </AppRoot>
  );
}
