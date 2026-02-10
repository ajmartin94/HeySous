import { initializeTelegramSDK } from './init';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@telegram-apps/telegram-ui/dist/styles.css';
import './theme/variables.css';

async function bootstrap() {
  await initializeTelegramSDK();
  const root = document.getElementById('root')!;
  createRoot(root).render(<App />);
}

bootstrap();
