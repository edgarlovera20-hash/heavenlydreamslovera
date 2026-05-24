import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './mobile.css';
import { installApiFetch } from '../lib/apiClient';
import { routeToDeviceVersion } from '../lib/device';
import MobileFieldApp from './MobileFieldApp';

installApiFetch();
const redirectedToDeviceVersion = routeToDeviceVersion();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw-mobile.js', { scope: '/m/' }).catch(() => {
      // Development and private browsing can block service workers.
    });
  });
}

if (!redirectedToDeviceVersion) {
  createRoot(document.getElementById('mobile-root')!).render(
    <StrictMode>
      <MobileFieldApp />
    </StrictMode>,
  );
}
