import React, { useEffect, useState } from 'react';
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
  const [randomTip, setRandomTip] = useState('');

  useEffect(() => {
    if (show) {
      setRandomTip(LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)]);
    }
  }, [show]);

  useEffect(() => {
    if (!isInitializing && !isSpaceLoading) {
      const timer = setTimeout(() => setIsStabilizing(false), 800);
      return () => clearTimeout(timer);
    } else {
      setIsStabilizing(true);
    }
  }, [isInitializing, isSpaceLoading]);

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