import { useState, useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';

export function usePWAUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateServiceWorker, setUpdateServiceWorker] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    // Add logs to debug why it's not working
    console.log('[PWA] Registering service worker...');
    const updateSW = registerSW({
      onNeedRefresh() {
        console.log('[PWA] New content available, refreshing...');
        setNeedRefresh(true);
        // Automatically refresh after a short delay for autoUpdate type
        // This makes the autoUpdate seamless as requested.
        // The user will still see the toast for a moment.
        setTimeout(() => {
          setIsUpdating(true);
          updateSW(true); // Force update and reload
        }, 3000); 
      },
      onOfflineReady() {
        console.log('[PWA] App ready for offline use.');
      },
      onRegistered(registration) {
        console.log('[PWA] Service Worker Registered:', registration);
      },
      onRegisterError(error) {
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

