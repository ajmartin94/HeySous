import { Outlet } from 'react-router-dom';
import { useBackButton } from './BackButton';
import './Layout.css';

export function Layout() {
  useBackButton();

  return (
    <div
      className="layout-root"
      style={{
        paddingTop: 'calc(var(--tg-content-safe-area-inset-top, 16px) + var(--tg-safe-area-inset-top, 56px))',
        paddingBottom: 'var(--tg-viewport-content-safe-area-inset-bottom, 0px)',
      }}
    >
      <Outlet />
    </div>
  );
}
