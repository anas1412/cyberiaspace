import React, { useState, useEffect } from 'react';
import {
  Settings, HelpCircle, Info, ExternalLink,
  ChevronDown, MessageSquare, FileText, Sun, Moon, Command
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { APP_VERSION } from '../../constants';
import { useStore } from '../../store/useStore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const AccountMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isOpen && !target.closest('.account-menu-container')) setIsOpen(false);
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, [isOpen]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="relative account-menu-container pointer-events-auto">
      {/* Trigger Pill */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-[44px] px-4 glass backdrop-blur-xl rounded-2xl border flex items-center gap-3 transition-all group shadow-lg shadow-[var(--glass-border)]",
          isOpen ? "bg-[var(--glass-bg)] border-[var(--glass-border)]" : "border-[var(--glass-border)] hover:border-[var(--accent)]/30"
        )}
      >
        <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/10 border border-[var(--glass-border)] flex items-center justify-center shadow-sm">
          <Info className="w-3.5 h-3.5 text-[var(--accent)]" />
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <span className="text-[12px] font-semibold tracking-wider text-[var(--text-primary)]">
            System
          </span>
        </div>

        <ChevronDown className={cn("w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full right-0 mt-2 w-64 glass backdrop-blur-xl rounded-2xl border border-[var(--glass-border)] shadow-2xl overflow-hidden z-[10002]"
          >
            <div className="p-4">
              {/* App Info */}
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[var(--glass-border)]">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 border border-[var(--glass-border)] flex items-center justify-center">
                  <Command className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <div>
                  <h4 className="text-[13px] font-semibold tracking-wide text-[var(--text-primary)]">Cyberia</h4>
                  <p className="text-[11px] font-medium text-[var(--text-muted)]">v{APP_VERSION}</p>
                </div>
              </div>

              {/* Navigation */}
              <div className="space-y-1 mb-4">
                <button
                  onClick={() => { setIsOpen(false); (window as any)._openSettings?.(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--text-primary)]/5 text-[12px] font-semibold tracking-wide text-[var(--text-primary)] transition-colors group"
                >
                  <Settings className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:scale-110 transition-transform" />
                  Settings
                </button>
                <button
                  onClick={() => { setIsOpen(false); (window as any)._openShortcuts?.(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--text-primary)]/5 text-[12px] font-semibold tracking-wide text-[var(--text-primary)] transition-colors group"
                >
                  <Command className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:scale-110 transition-transform" />
                  Command Center
                </button>
                <button
                  onClick={() => { setIsOpen(false); (window as any)._openHelp?.(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--text-primary)]/5 text-[12px] font-semibold tracking-wide text-[var(--text-primary)] transition-colors group"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:scale-110 transition-transform" />
                  Help
                </button>
              </div>

              {/* Theme Toggle */}
              <div className="mb-4 pt-3 border-t border-[var(--glass-border)]">
                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[var(--text-primary)]/5 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    {theme === 'light' ? (
                      <Moon className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:scale-110 transition-transform" />
                    ) : (
                      <Sun className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:scale-110 transition-transform" />
                    )}
                    <span className="text-[12px] font-semibold tracking-wide text-[var(--text-primary)]">
                      {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                    {theme === 'light' ? 'Light' : 'Dark'}
                  </span>
                </button>
              </div>

              {/* External Links */}
              <div className="pt-3 border-t border-[var(--glass-border)] space-y-1">
                <button
                  onClick={() => window.open('/feedback', '_blank')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--text-primary)]/5 text-[12px] font-semibold tracking-wide text-[var(--text-primary)] transition-colors group"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:scale-110 transition-transform" />
                  Feedback
                  <ExternalLink className="w-2.5 h-2.5 ml-auto text-[var(--text-muted)]" />
                </button>
                <button
                  onClick={() => window.open('/docs', '_blank')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--text-primary)]/5 text-[12px] font-semibold tracking-wide text-[var(--text-primary)] transition-colors group"
                >
                  <FileText className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:scale-110 transition-transform" />
                  Documentation
                  <ExternalLink className="w-2.5 h-2.5 ml-auto text-[var(--text-muted)]" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
