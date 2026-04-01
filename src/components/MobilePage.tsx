import React from 'react';
import { motion } from 'framer-motion';
import { Monitor, ArrowLeft, Smartphone, Tablet, MousePointer2 } from 'lucide-react';

const MobilePage: React.FC = () => {
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'https://cyberia.tn';
    }
  };

  return (
    <div className="fixed inset-0 z-[10003] bg-[var(--bg-page)] flex items-center justify-center p-6 overflow-hidden select-none">
      {/* Background Layers matching Cyberia theme */}
      <div className="fixed inset-0 z-0">
        <div className="stars-layer stars-1" />
        <div className="stars-layer stars-2" />
        <div className="stars-layer stars-twinkle" />
        <div className="nebula-cloud" />
        <div className="grain" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md md:max-w-lg"
      >
        <button
          onClick={handleBack}
          className="mb-8 flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-semibold tracking-widest">Back to Homepage</span>
        </button>

        <div className="glass p-8 md:p-16 rounded-2xl border border-[var(--glass-border)] shadow-2xl space-y-10 text-center">
          <div className="space-y-4">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-[var(--accent)]/20 blur-2xl rounded-full scale-150 animate-pulse" />
                <div className="flex items-center gap-4 relative z-10">
                  <Smartphone className="w-8 h-8 text-[var(--text-muted)] opacity-40" />
                  <div className="w-8 h-[1px] bg-white/10" />
                  <Monitor className="w-10 h-10 text-[var(--accent)]" />
                  <div className="w-8 h-[1px] bg-white/10" />
                  <Tablet className="w-8 h-8 text-[var(--text-muted)] opacity-40" />
                </div>
              </div>
            </div>
            
            <h1 className="text-3xl md:text-5xl font-black text-[var(--text-primary)] uppercase tracking-tighter leading-none">
              Desktop <span style={{ color: 'var(--accent)' }}>Required</span>
            </h1>
            <p className="text-[10px] md:text-[12px] font-bold text-[var(--text-muted)] uppercase tracking-[0.3em]">
              Spatial Thinking Needs Space
            </p>
          </div>

          <div className="space-y-6">
            <p className="text-[11px] md:text-[13px] text-[var(--text-muted)] leading-relaxed font-medium max-w-sm mx-auto uppercase tracking-wider">
              The Cyberia spatial engine is built for large-scale thinking. For the best experience, we require a <span className="text-[var(--text-primary)] font-bold">Laptop or Desktop</span> with a precise input method like a mouse or trackpad.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="glass p-4 rounded-xl border border-[var(--glass-border)] space-y-2">
                <Monitor className="w-5 h-5 text-[var(--accent-secondary)] mx-auto opacity-60" />
                <p className="text-[8px] font-semibold tracking-widest text-[var(--text-muted)]">Wide Viewports</p>
              </div>
              <div className="glass p-4 rounded-xl border border-[var(--glass-border)] space-y-2">
                <MousePointer2 className="w-5 h-5 text-[var(--accent-secondary)] mx-auto opacity-60" />
                <p className="text-[8px] font-semibold tracking-widest text-[var(--text-muted)]">Precise Input</p>
              </div>
            </div>

            <div className="pt-6">
              <a
                href="https://cyberia.tn"
                className="inline-block w-full py-4 bg-[var(--glass-bg)] hover:bg-[var(--bg-page)] border border-[var(--glass-border)] text-[var(--text-primary)] rounded-xl text-[10px] font-semibold tracking-[0.3em] transition-all text-center"
              >
                Return to Landing Page
              </a>
            </div>
          </div>

          <div className="pt-8 border-t border-[var(--glass-border)] text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20">
              <Smartphone className="w-3 h-3 text-[var(--accent)]" />
              <span className="text-[9px] font-semibold tracking-widest text-[var(--accent)]">Mobile App Coming Soon</span>
            </div>
            <p className="text-[8px] font-semibold tracking-[0.2em] text-[var(--text-muted)] italic leading-loose">
              Join our community for mobile app updates <br/>
              and future cross-platform features.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default MobilePage;
