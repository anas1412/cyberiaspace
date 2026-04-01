import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import { usePWAUpdate } from '../hooks/usePWAUpdate';

const UpdateToast: React.FC = () => {
  const { needRefresh, isUpdating, updateServiceWorker } = usePWAUpdate();

  if (!needRefresh) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[20000] w-[90%] max-w-md"
      >
        <div className="glass p-1 rounded-3xl border border-blue-500/30 shadow-[0_0_50px_rgba(59,130,246,0.3)] bg-blue-500/10 backdrop-blur-3xl overflow-hidden">
          <div className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 shrink-0">
              {isUpdating ? (
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              ) : (
                <RefreshCw className="w-6 h-6 text-blue-400 animate-spin-slow" />
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3 h-3 text-blue-400" />
                <h4 className="text-[10px] font-semibold tracking-[0.2em] text-white">System Update</h4>
              </div>
              <p className="text-[11px] font-bold text-[var(--text-muted)] leading-tight uppercase tracking-wider">
                {isUpdating ? 'Applying new version to your space...' : 'A new version of Cyberia is ready for your space.'}
              </p>
            </div>

            {!isUpdating && (
              <button
                onClick={() => updateServiceWorker?.(true)} // Force update and reload
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-[10px] font-semibold tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95 whitespace-nowrap"
              >
                Update Now
              </button>
            )}
          </div>
          
          <div className="h-1 w-full bg-[var(--glass-border)] relative">
            <motion.div 
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: isUpdating ? 1.5 : 10, ease: "linear" }} // Shorter duration if updating
              className="absolute inset-y-0 left-0 bg-blue-500/50"
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UpdateToast;
