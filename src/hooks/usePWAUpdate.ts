import { useState, useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';

export function usePWAUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateServiceWorker, setUpdateServiceWorker] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        console.log('[PWA] Offline Ready');
      },
    });
    setUpdateServiceWorker(() => async () => {
      await updateSW(true);
    });
  }, []);

  return { needRefresh, updateServiceWorker };
}
