import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { RefreshCw } from 'lucide-react';

const LOADING_TIPS = [
  // Shortcuts
  "Press SPACE to create a new thought",
  "Drag to move. Scroll to zoom.",
  "CTRL+Z to undo, CTRL+Y to redo",
  "CTRL+V to paste from clipboard",
  "Drag files directly onto the canvas to import",
  // Features
  "Switch between Spatial, Kanban, and Calendar views",
  "Group thoughts into Stacks by dragging them together",
  "Ask Oracle to find, create, or connect anything",
  "Share your space with your team",
  "Your data syncs automatically across devices",
];

interface LoadingOverlayProps {
  force?: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ force }) => {
  const isInitializing = useStore((state) => state.isInitializing);
  const isSpaceLoading = useStore((state) => state.isSpaceLoading);
  const [isStabilizing, setIsStabilizing] = useState(true);
  const show = force || isInitializing || isSpaceLoading || isStabilizing;
  const [showReset, setShowReset] = useState(false);

  // Pick random tip when loading shows
  const [randomTip, setRandomTip] = useState('');

  useEffect(() => {
    if (show) {
      setRandomTip(LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)]);
    }
  }, [show]);

  useEffect(() => {
    if (!isInitializing && !isSpaceLoading) {
      // Add a small buffer for the engine to stabilize
      const timer = setTimeout(() => setIsStabilizing(false), 800);
      return () => clearTimeout(timer);
    } else {
      setIsStabilizing((prev) => {
        if (!prev) return true;
        return prev;
      });
    }
  }, [isInitializing, isSpaceLoading]);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        setShowReset(true);
      }, 15000); // Show reset button after 15 seconds
      return () => clearTimeout(timer);
    } else {
      setShowReset((prev) => {
        if (prev) return false;
        return prev;
      });
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
          exit={{ opacity: 0, transition: { duration: 0.5, ease: "easeInOut" } }}
          className="fixed inset-0 z-[20000] flex flex-col items-center justify-center overflow-hidden"
          style={{ backgroundColor: 'var(--bg-page)' }}
        >
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-bold tracking-tighter text-[var(--text-primary)] uppercase">
              CYBERIA<span className="text-[var(--accent)]"> SPACE</span>
            </h1>
            
            {/* Random Loading Tip */}
            <p className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-widest max-w-[280px] text-center">
              {randomTip}
            </p>
            
            {/* Simple Spinner */}
            <div className="w-5 h-5 border-2 border-white/5 border-t-[var(--accent)] rounded-full animate-spin" />

            {showReset && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={handleForceReset}
                className="mt-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-white transition-colors group whitespace-nowrap"
              >
                <RefreshCw className="w-3 h-3 group-hover:rotate-45 transition-transform" />
                <span>Don't panic, your data is being processed</span>
              </motion.button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingOverlay;
