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
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateServiceWorker, setUpdateServiceWorker] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (!registerSW) return;

    console.log('[PWA] Registering service worker...');
    const updateSW = registerSW({
      onNeedRefresh() {
        console.log('[PWA] New content available, refreshing immediately...');
        setIsUpdating(true);
        updateSW(true);
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

  return { needRefresh: false, isUpdating, updateServiceWorker };
}
