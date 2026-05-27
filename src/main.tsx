import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Toaster } from 'sonner';
import { installApiFetch } from './lib/apiClient';
import { routeToDeviceVersion } from './lib/device';

installApiFetch();
const redirectedToDeviceVersion = routeToDeviceVersion();

function registerServiceWorkerWhenIdle(scriptUrl: string, options?: RegistrationOptions) {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    const register = () => {
      navigator.serviceWorker.register(scriptUrl, options).catch(() => {/* silent in dev */});
    };
    const requestIdleCallback = (window as any).requestIdleCallback;
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(register, { timeout: 3000 });
    } else {
      window.setTimeout(register, 500);
    }
  });
}

registerServiceWorkerWhenIdle('/sw.js');

if (!redirectedToDeviceVersion) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <Toaster position="top-right" richColors theme="dark" />
    </StrictMode>,
  );
}
