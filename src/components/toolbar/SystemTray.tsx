import React from 'react';
import { useStore } from '../../store/useStore';
import { 
  Keyboard, CircleHelp, Settings, Sun, Moon
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SystemTrayProps {
  isShortcutsOpen: boolean;
  setIsShortcutsOpen: (val: boolean) => void;
  isHelpOpen: boolean;
  setIsHelpOpen: (val: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (val: boolean) => void;
}

export const SystemTray: React.FC<SystemTrayProps> = ({ 
  isShortcutsOpen, setIsShortcutsOpen, isHelpOpen, setIsHelpOpen, 
  isSettingsOpen, setIsSettingsOpen
}) => {
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="fixed bottom-4 md:bottom-8 right-4 md:right-8 z-[9999] flex flex-col items-end gap-4 pointer-events-none system-tray-container mobile-bottom-bar-adjust">
      <div className="flex items-center gap-3 pointer-events-auto">
        {/* Interface Cluster: Theme, Shortcuts, Help, Settings */}
        <div className="flex items-center gap-1.5 glass backdrop-blur-xl p-1 rounded-2xl border border-[var(--glass-border)] h-[44px] shadow-lg shadow-[var(--glass-border)] bg-[var(--glass-bg)]">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="group relative w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl transition-all text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
          >
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
              <div className="glass px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex items-center gap-2 shadow-2xl bg-[var(--glass-bg)] backdrop-blur-xl">
                <span className="text-[12px] font-semibold tracking-wide text-[var(--text-primary)]">{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
              </div>
            </div>
            {theme === 'light' ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={() => setIsShortcutsOpen(!isShortcutsOpen)}
            aria-label="Command Center"
className={cn(
               "group relative hidden md:flex w-9 h-9 md:w-10 md:h-10 items-center justify-center rounded-xl transition-all",
               isShortcutsOpen ? "bg-[var(--glass-bg)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
             )}
          >
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
              <div className="glass px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex items-center gap-2 shadow-2xl bg-[var(--glass-bg)] backdrop-blur-xl">
                <span className="text-[12px] font-semibold tracking-wide text-[var(--text-primary)]">Command Center</span>
              </div>
            </div>
            <Keyboard className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsHelpOpen(!isHelpOpen)}
            aria-label="Help"
className={cn(
               "group relative w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl transition-all",
               isHelpOpen ? "bg-[var(--glass-bg)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
             )}
          >
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
              <div className="glass px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex items-center gap-2 shadow-2xl bg-[var(--glass-bg)] backdrop-blur-xl">
                <span className="text-[12px] font-semibold tracking-wide text-[var(--text-primary)]">Help</span>
              </div>
            </div>
            <CircleHelp className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            aria-label="Settings"
className={cn(
               "group relative w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl transition-all",
               isSettingsOpen ? "bg-[var(--glass-bg)] text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
             )}
          >
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
              <div className="glass px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex items-center gap-2 shadow-2xl bg-[var(--glass-bg)] backdrop-blur-xl">
                <span className="text-[12px] font-semibold tracking-wide text-[var(--text-primary)]">Settings</span>
              </div>
            </div>
            <Settings className={cn("w-4 h-4 transition-transform duration-500", isSettingsOpen && "rotate-90")} />
          </button>
        </div>
      </div>
    </div>
  );
};
