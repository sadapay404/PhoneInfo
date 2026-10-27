import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initNativeBack } from './lib/nativeBack';
import './styles.css';

// Background Sync types are not in TypeScript's DOM lib yet.
interface BackgroundSyncRegistration {
  sync?: { register(tag: string): Promise<void> };
  periodicSync?: { register(tag: string, options: { minInterval: number }): Promise<void> };
}

initNativeBack();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const reg = (await navigator.serviceWorker.register('/sw.js')) as ServiceWorkerRegistration & BackgroundSyncRegistration;
      // Background Sync: lets the browser retry the catalog prefetch when connectivity returns.
      await reg.sync?.register('catalog-sync').catch(() => undefined);
      // Periodic Background Sync (Chromium, installed PWAs with permission only).
      await reg.periodicSync?.register('catalog-sync', { minInterval: 24 * 60 * 60 * 1000 }).catch(() => undefined);
    } catch {
      // Offline caching is an enhancement; the app works without it.
    }
  });
}
