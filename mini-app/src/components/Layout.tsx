import { Outlet } from 'react-router-dom';
import { useBackButton } from './BackButton';

export function Layout() {
  useBackButton();

  return (
    <div
      style={{
        paddingTop: 'var(--tg-viewport-content-safe-area-inset-top, 0px)',
        paddingBottom: 'var(--tg-viewport-content-safe-area-inset-bottom, 0px)',
        minHeight: '100vh',
      }}
    >
      <Outlet />
    </div>
  );
}
