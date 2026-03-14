import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { RefreshCw } from 'lucide-react';

interface LoadingOverlayProps {
  force?: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ force }) => {
  const isInitializing = useStore((state) => state.isInitializing);
  const isSpaceLoading = useStore((state) => state.isSpaceLoading);
  const [isStabilizing, setIsStabilizing] = useState(true);
  const show = force || isInitializing || isSpaceLoading || isStabilizing;
  const [showReset, setShowReset] = useState(false);

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
              CYBERIA<span className="text-[var(--accent)]"> WORKSPACE</span>
            </h1>
            
            {/* Simple Spinner */}
            <div className="w-5 h-5 border-2 border-white/5 border-t-[var(--accent)] rounded-full animate-spin" />

            {showReset && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={handleForceReset}
                className="mt-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors group whitespace-nowrap"
              >
                <RefreshCw className="w-3 h-3 group-hover:rotate-45 transition-transform" />
                <span>Loading taking too long? <span className="text-[#6366f1] border-b border-[#6366f1]/30">Force Reset</span></span>
              </motion.button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingOverlay;
