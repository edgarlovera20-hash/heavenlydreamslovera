import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Toaster } from 'sonner';
import { installApiFetch } from './lib/apiClient';
import { routeToDeviceVersion } from './lib/device';

installApiFetch();
const redirectedToDeviceVersion = routeToDeviceVersion();

// Register PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {/* silent in dev */});
  });
}

if (!redirectedToDeviceVersion) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
      <Toaster position="top-right" richColors theme="dark" />
    </StrictMode>,
  );
}
