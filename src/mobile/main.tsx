import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './mobile.css';
import { installApiFetch } from '../lib/apiClient';
import { routeToDeviceVersion } from '../lib/device';
import MobileFieldApp from './MobileFieldApp';

installApiFetch();
const redirectedToDeviceVersion = routeToDeviceVersion();

function registerServiceWorkerWhenIdle(scriptUrl: string, options?: RegistrationOptions) {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    const register = () => {
      navigator.serviceWorker.register(scriptUrl, options).catch(() => {
        // Development and private browsing can block service workers.
      });
    };
    const requestIdleCallback = (window as any).requestIdleCallback;
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(register, { timeout: 3000 });
    } else {
      window.setTimeout(register, 500);
    }
  });
}

registerServiceWorkerWhenIdle('/sw-mobile.js', { scope: '/m/' });

if (!redirectedToDeviceVersion) {
  createRoot(document.getElementById('mobile-root')!).render(
    <StrictMode>
      <MobileFieldApp />
    </StrictMode>,
  );
}
