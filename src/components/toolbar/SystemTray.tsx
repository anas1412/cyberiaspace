import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  Keyboard, CircleHelp, Settings, Zap
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
  const user = useAuthStore((state) => state.user);

  return (
    <div className="fixed bottom-4 md:bottom-8 right-4 md:right-8 z-[9999] flex flex-col items-end gap-4 pointer-events-none system-tray-container mobile-bottom-bar-adjust">
      <div className="flex items-center gap-3 pointer-events-auto">
        {/* Upgrade Cluster - visible only to Free users */}
        {user?.plan !== 'pro' && (
          <div className="flex items-center gap-1.5 glass p-1 rounded-2xl border border-amber-500/20 h-[48px] bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
            <div className="relative group">
              <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
                <div className="glass px-3 py-1.5 rounded-xl border border-amber-500/20 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Unlock Pro Features</span>
                </div>
              </div>
              <button 
                onClick={() => window.location.href = '/pricing'}
                className="flex items-center gap-2.5 px-3 h-9 md:h-10 rounded-xl bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 transition-all border border-amber-500/20 group/upgrade shadow-inner"
              >
                <Zap className="w-3.5 h-3.5 fill-amber-500/20 group-hover:scale-110 transition-transform animate-pulse" />
                <span className="hidden md:block text-[9px] font-black uppercase tracking-[0.2em]">Upgrade</span>
              </button>
            </div>
          </div>
        )}

        {/* Interface Cluster: Shortcuts, Help, Settings */}
        <div className="flex items-center gap-1.5 glass p-1 rounded-2xl border border-white/5 h-[48px]">
          <button 
            onClick={() => setIsShortcutsOpen(!isShortcutsOpen)} 
            className={cn(
              "group relative hidden md:flex w-9 h-9 md:w-10 md:h-10 items-center justify-center rounded-xl transition-all", 
              isShortcutsOpen ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
            )}
          >
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
              <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Command Center</span>
              </div>
            </div>
            <Keyboard className="w-4 h-4" />
          </button>

          <button 
            onClick={() => setIsHelpOpen(!isHelpOpen)} 
            className={cn(
              "group relative w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl transition-all", 
              isHelpOpen ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
            )}
          >
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
              <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Help</span>
              </div>
            </div>
            <CircleHelp className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
            className={cn(
              "group relative w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl transition-all", 
              isSettingsOpen ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
            )}
          >
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
              <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Settings</span>
              </div>
            </div>
            <Settings className={cn("w-4 h-4 transition-transform duration-500", isSettingsOpen && "rotate-90")} />
          </button>
        </div>
      </div>
    </div>
  );
};
