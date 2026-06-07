import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { RefreshCw, Loader2 } from 'lucide-react';

const LOADING_TIPS = [
  "Press SPACE to create a new thought",
  "Drag to move. Scroll to zoom.",
  "CTRL+Z to undo, CTRL+Y to redo",
  "CTRL+V to paste from clipboard",
  "Drag files directly onto the canvas to import",
  "Switch between Spatial, Kanban, and Calendar views",
  "Group thoughts into Stacks by dragging them together",
  "Ask Cyberia AI to find, create, or connect anything",
  "Share your space with your team",
  "Your data syncs automatically across devices",
];

interface LoadingOverlayProps {
  force?: boolean;
}

const MIN_LOADING_DISPLAY_MS = 300; // Minimum time to show loading (prevents flash)
const MIN_APP_DISPLAY_MS = 200; // Minimum time before re-showing loading (prevents blink)

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ force }) => {
  const isInitializing = useStore((state) => state.isInitializing);
  const isSpaceLoading = useStore((state) => state.isSpaceLoading);
  const [showReset, setShowReset] = useState(false);
  const [randomTip, setRandomTip] = useState('');
  
  // Track loading state with timestamps for minimum display time
  const loadingStartTime = useRef<number | null>(null);
  const appShowTime = useRef<number>(0);
  const [shouldShow, setShouldShow] = useState(true); // Start with true to avoid flash on first render
  
  // Calculate if we should show based on minimum display times
  const show = force || shouldShow;

  useEffect(() => {
    const rawShow = isInitializing || isSpaceLoading;
    
    if (rawShow) {
      // Loading becoming true
      const now = Date.now();
      
      // If app was shown recently, wait before showing loading again (prevents blink)
      if (appShowTime.current > 0 && now - appShowTime.current < MIN_APP_DISPLAY_MS) {
        // Schedule showing loading after minimum app display time
        const delay = MIN_APP_DISPLAY_MS - (now - appShowTime.current);
        const timer = setTimeout(() => {
          setShouldShow(true);
        }, delay);
        return () => clearTimeout(timer);
      }
      
      // Start tracking loading display time
      if (loadingStartTime.current === null) {
        loadingStartTime.current = now;
      }
      
      setShouldShow(true);
      appShowTime.current = 0; // Clear app show time
    } else {
      // Loading becoming false
      const now = Date.now();
      
      // Record when app started showing
      appShowTime.current = now;
      loadingStartTime.current = null; // Clear loading start time
      
      // If loading showed for less than minimum, keep showing for a bit
      if (shouldShow) {
        const elapsed = now - (loadingStartTime.current || now);
        if (elapsed < MIN_LOADING_DISPLAY_MS) {
          const remaining = MIN_LOADING_DISPLAY_MS - elapsed;
          const timer = setTimeout(() => {
            setShouldShow(false);
          }, remaining);
          return () => clearTimeout(timer);
        }
      }
      
      // Wait for stabilizing delay before hiding
      const timer = setTimeout(() => setShouldShow(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isInitializing, isSpaceLoading]);

  useEffect(() => {
    if (show) {
      setRandomTip(LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)]);
    }
  }, [show]);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setShowReset(true), 12000); 
      return () => clearTimeout(timer);
    } else {
      setShowReset(false);
    }
  }, [show]);

  const handleForceReset = () => {
    window.location.href = '/';
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
          className="fixed inset-0 z-[20000] flex flex-col items-center justify-center overflow-hidden bg-[var(--bg-page)]"
        >
          {/* Ambient Glow background */}
          <div className="absolute inset-0 bg-[var(--bg-ambient)] opacity-30 pointer-events-none" />

          <div className="relative flex flex-col items-center gap-8">
            <h1 className="text-xl md:text-2xl font-bold tracking-tighter text-[var(--text-primary)] uppercase select-none">
              CYBERIA<span className="text-[var(--accent)]"> SPACE</span>
            </h1>
            
            <div className="flex flex-col items-center gap-4">
               {/* Professional Spinner */}
              <div className="relative">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
                <div className="absolute inset-0 blur-lg bg-[var(--accent)]/20 animate-pulse" />
              </div>

              {/* Tip - Scaled down for better hierarchy */}
              <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-[0.25em] max-w-[300px] text-center leading-relaxed px-6">
                {randomTip}
              </p>
            </div>

            {showReset && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleForceReset}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[10px] font-bold tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all group"
              >
                <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                <span>FORCE RECOVERY</span>
              </motion.button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingOverlay;