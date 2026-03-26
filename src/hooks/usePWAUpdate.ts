import { useState, useEffect } from 'react';

let registerSW: ((options?: any) => any) | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pwaRegister = require('virtual:pwa-register');
  registerSW = pwaRegister.registerSW;
} catch (e) {
  // PWA not enabled - this is fine for marketing site
}

export function usePWAUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateServiceWorker, setUpdateServiceWorker] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (!registerSW) return;

    console.log('[PWA] Registering service worker...');
    const updateSW = registerSW({
      async onNeedRefresh() {
        console.log('[PWA] New content available, clearing cache and refreshing...');
        setNeedRefresh(true);
        setIsUpdating(true);

        // Clear all Cache Storage (App Files)
        // This ensures old JS/CSS are purged before reload
        // Does NOT affect IndexedDB (CyberiaDB)
        if ('caches' in window) {
          try {
            const names = await caches.keys();
            await Promise.all(names.map(name => caches.delete(name)));
            console.log('[PWA] Cache Storage cleared successfully');
          } catch (err) {
            console.error('[PWA] Failed to clear Cache Storage:', err);
          }
        }

        // Trigger immediate update and reload
        await updateSW(true);
      },
      onOfflineReady() {
        console.log('[PWA] App ready for offline use.');
      },
      onRegistered(registration: any) {
        console.log('[PWA] Service Worker Registered:', registration);
      },
      onRegisterError(error: any) {
        console.error('[PWA] Service Worker registration error:', error);
      }
    });

    setUpdateServiceWorker(() => async (reload = true) => {
      setIsUpdating(true);
      await updateSW(reload);
    });
  }, []);

  return { needRefresh, isUpdating, updateServiceWorker };
}
