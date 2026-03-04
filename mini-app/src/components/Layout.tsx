import { Outlet } from 'react-router-dom';
import { useBackButton } from './BackButton';
import './Layout.css';

export function Layout() {
  useBackButton();

  return (
    <div
      className="layout-root"
      style={{
        paddingTop: 'var(--tg-viewport-content-safe-area-inset-top, 0px)',
        paddingBottom: 'var(--tg-viewport-content-safe-area-inset-bottom, 0px)',
      }}
    >
      <Outlet />
    </div>
  );
}
