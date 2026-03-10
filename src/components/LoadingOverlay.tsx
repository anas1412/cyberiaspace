import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { APP_VERSION } from '../constants';
import { Bot, Zap, Shield, Cpu, RefreshCw } from 'lucide-react';

interface LoadingOverlayProps {
  force?: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ force }) => {
  const isInitializing = useStore((state) => state.isInitializing);
  const show = force || isInitializing;
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        setShowReset(true);
      }, 15000); // Show reset button after 15 seconds
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
          exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
          className="fixed inset-0 z-[20000] bg-[#020408] flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
          </div>


          <div className="relative flex flex-col items-center">
            {/* Logo Hexagon / Core */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="relative w-24 h-24 mb-12"
            >
              <div className="absolute inset-0 border-2 border-blue-500/20 rounded-2xl rotate-45 animate-[spin_10s_linear_infinite]" />
              <div className="absolute inset-0 border border-blue-400/40 rounded-xl -rotate-12 animate-[spin_15s_linear_infinite_reverse]" />
              
              <div className="absolute inset-0 flex items-center justify-center">
                <img src="/logo.png" alt="Cyberia" className="w-12 h-12 relative z-10" />
              </div>

              {/* Ping Rings */}
              <motion.div
                animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                className="absolute inset-0 border-2 border-blue-500/30 rounded-full"
              />
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-black tracking-[0.3em] text-white uppercase mb-2"
            >
              Cyberia
            </motion.h1>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-2 mb-8"
            >
              <span className="h-[1px] w-8 bg-gradient-to-r from-transparent to-[var(--accent)]/50" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--accent-secondary)' }}>Cyberia Workspace</span>
              <span className="h-[1px] w-8 bg-gradient-to-l from-transparent to-[var(--accent)]/50" />
            </motion.div>

            {/* Status Steps */}
            <div className="flex flex-col gap-3 w-64">
              <StatusItem delay={0.6} icon={<Shield className="w-3 h-3" />} label="Finding your account" active={isInitializing} />
              <StatusItem delay={0.8} icon={<Cpu className="w-3 h-3" />} label="Getting your spaces ready" active={isInitializing} />
              <StatusItem delay={1.0} icon={<Zap className="w-3 h-3" />} label="Putting things in place" active={isInitializing} />
              <StatusItem delay={1.2} icon={<Bot className="w-3 h-3" />} label="Finalizing setup" active={isInitializing} />
            </div>

            {/* Progress Bar */}
            <div className="mt-12 w-48 h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="w-full h-full bg-gradient-to-r from-transparent via-blue-500 to-transparent"
              />
            </div>

            {showReset && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                onClick={handleForceReset}
                className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors group"
              >
                <RefreshCw className="w-3 h-3 group-hover:rotate-45 transition-transform" />
                <span>Loading taking too long? <span className="text-blue-400">Go Back to Workspace</span></span>
              </motion.button>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ delay: 2 }}
            className="absolute bottom-12 text-[10px] font-mono text-slate-500 uppercase tracking-widest"
          >
            v{APP_VERSION} • STABLE BUILD
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const StatusItem: React.FC<{ delay: number; icon: React.ReactNode; label: string; active?: boolean }> = ({ delay, icon, label, active }) => (
  <motion.div
    initial={{ x: -10, opacity: 0 }}
    animate={{ x: 0, opacity: active ? 1 : 0.3 }}
    transition={{ delay }}
    className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/[0.02] border border-white/5"
  >
    <div className="text-blue-400">{icon}</div>
    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{label}</span>
    {active && (
      <motion.div
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="ml-auto w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]"
      />
    )}
  </motion.div>
);

export default LoadingOverlay;
