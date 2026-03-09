import React from 'react';
import { useStore } from '../../store/useStore';
import { MonitorSmartphone, Download, Upload, Camera, EyeOff, Eye, EyeClosed, Keyboard, CircleHelp, MoreVertical, RefreshCw, Zap, Gauge, Trash2 } from 'lucide-react';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SystemTrayProps {
  isReadOnly: boolean;
  user: any;
  limits: any;
  isChatOpen: boolean;
  setChatOpen: (val: boolean) => void;
  openPricing: () => void;
  isShortcutsOpen: boolean;
  setIsShortcutsOpen: (val: boolean) => void;
  isHelpOpen: boolean;
  setIsHelpOpen: (val: boolean) => void;
  isSystemMenuOpen: boolean;
  setIsSystemMenuOpen: (val: boolean) => void;
  theme: 'cyberia' | 'sea' | 'forest' | 'rain' | null;
  setTheme: (val: 'cyberia' | 'sea' | 'forest' | 'rain') => void;
  deferredPrompt: any;
  handleInstall: () => void;
  handleExport: () => void;
  handleScreenshot: () => void;
  handleImport: (e: any) => void;
  isCapturing: boolean;
  openModal: (cfg: any) => void;
  performanceMode: boolean;

  setPerformanceMode: (val: boolean) => void;
  customBg: string | null;
  setCustomBg: (bg: string | null) => Promise<void>;
  activeSpace: any;
  handleTogglePhysics: () => void;
}

export const SystemTray: React.FC<SystemTrayProps> = ({ 
  isReadOnly, user, limits, isChatOpen, setChatOpen, openPricing, 
  isShortcutsOpen, setIsShortcutsOpen, isHelpOpen, setIsHelpOpen, 
  isSystemMenuOpen, setIsSystemMenuOpen, theme, setTheme, 
  deferredPrompt, handleInstall, handleExport, handleScreenshot, handleImport, isCapturing, openModal,
  performanceMode, setPerformanceMode,

  customBg, setCustomBg,
  activeSpace, handleTogglePhysics
}) => {
  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      openModal({
        title: 'Background too large',
        description: 'Please use an image or GIF under 2MB to ensure smooth synchronization.',
        type: 'alert',
        confirmText: 'Okay'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setCustomBg(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="fixed bottom-4 md:bottom-8 right-4 md:right-8 z-[9999] flex flex-col items-end gap-3 pointer-events-none system-tray-container mobile-bottom-bar-adjust">
      <div className={cn("glass p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border border-white/10 shadow-2xl flex flex-col gap-1 transition-all pointer-events-auto w-72 md:w-80 animate-in fade-in slide-in-from-bottom-2 duration-300", isSystemMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none")}>

        
        {!isReadOnly && (
          <>
            <div className="px-1 md:px-2 py-3 border-b border-white/5 mb-3">
              <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Workspace Theme</p>
              <div className="grid grid-cols-4 gap-2">
                {(['cyberia', 'sea', 'forest', 'rain'] as const).map((id) => {
                  const labels = { cyberia: 'Space', sea: 'Sea', forest: 'Forest', rain: 'Rain' };
                  const colors = { cyberia: '#6366f1', sea: '#00b4d8', forest: '#2dce89', rain: '#d6d3d1' };
                  return (
                    <button 
                      key={id} 
                      onClick={() => setTheme(id)} 
                      className={cn(
                        "flex flex-col items-center gap-2 p-1.5 rounded-xl border transition-all", 
                        theme === id ? "bg-white/10 border-white/20 shadow-lg" : "border-transparent hover:bg-white/5"
                      )}
                    >
                      <div className="w-3.5 h-3.5 rounded-full shadow-lg" style={{ backgroundColor: colors[id] }} />
                      <span className={cn("text-[8px] font-bold uppercase tracking-widest", theme === id ? "text-white" : "text-slate-500")}>
                        {labels[id]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="px-1 md:px-2 py-3 border-b border-white/5 mb-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Custom Background</p>
                {customBg && (
                  <button 
                    onClick={() => setCustomBg(null)}
                    className="text-[8px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              <label className="flex items-center justify-center gap-3 px-3 py-3 rounded-xl md:rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer transition-all group">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 group-hover:text-white">
                    {customBg ? 'Change Background' : 'Upload Image / GIF'}
                  </span>
                  <span className="text-[7px] font-bold text-slate-600 uppercase tracking-widest">Max 2MB • Per Space</span>
                </div>
                <input type="file" className="hidden" accept="image/*,.gif" onChange={handleBgUpload} />
              </label>
            </div>
          </>
        )}

        {deferredPrompt && (<button onClick={handleInstall} className="flex items-center gap-3 px-3 py-3 rounded-xl md:rounded-2xl bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-[var(--accent-secondary)] transition-all mb-1 border border-[var(--accent)]/20"><MonitorSmartphone className="w-3.5 h-3.5" /> Install App</button>)}
        <button onClick={handleExport} className="flex items-center gap-3 px-3 py-3 rounded-xl md:rounded-2xl hover:bg-white/5 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-300 transition-colors"><Download className="w-3.5 h-3.5" /> Export backup to local</button>
        <label className="flex items-center gap-3 px-3 py-3 rounded-xl md:rounded-2xl hover:bg-white/5 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-300 transition-colors cursor-pointer"><Upload className="w-3.5 h-3.5" /> Import backup from local<input type="file" className="hidden" accept=".json" onChange={handleImport} /></label>
        <button onClick={handleScreenshot} disabled={isCapturing} className="flex items-center gap-3 px-3 py-3 rounded-xl md:rounded-2xl hover:bg-white/5 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-300 transition-colors"><Camera className="w-3.5 h-3.5" /> {isCapturing ? 'Saving...' : 'Screenshot'}</button>
        <div className="h-[1px] bg-white/5 my-3 mx-1"></div>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => { 
              openModal({ 
                title: 'Clear Everything?', 
                description: 'This will permanently delete ALL local data and your Cloud Backup (including files). This action is irreversible.', 
                type: 'reset_confirm', 
                confirmText: 'Nuclear Wipe', 
                onConfirm: () => useStore.getState().clearWorkspace() 
              }); 
              setIsSystemMenuOpen(false); 
            }} 
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl hover:bg-red-500/10 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-red-400 transition-colors border border-transparent hover:border-red-500/10"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
          <button 
            onClick={() => { 
              openModal({ 
                title: 'Factory Reset App?', 
                description: 'This will clear your local session and log you out. Your cloud data remains safe and can be restored by signing in again.', 
                type: 'reset_confirm', 
                confirmText: 'Reset Local', 
                onConfirm: () => useStore.getState().clearLocalData() 
              }); 
              setIsSystemMenuOpen(false); 
            }} 
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl hover:bg-red-500/10 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-red-400 transition-colors border border-transparent hover:border-red-500/10"
          >
            <RefreshCw className="w-3 h-3" /> Reset
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 pointer-events-auto">
        {/* Engine Cluster: Intelligence, Physics, Performance */}
        <div className="flex items-center gap-1.5 glass p-1.5 rounded-[1.5rem] border border-white/5">
          {/* Ask Oracle disabled */}
          {!isReadOnly && (
            <div className="relative group">
              <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
                <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                    {!user ? 'Sign in to ask Oracle' : 'Ask Oracle'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => { 
                  if (!user) {
                    window.history.pushState({}, '', '/login');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                    return;
                  }
                  if (!limits.AI_ENABLED) { openPricing(); return; } 
                  setChatOpen(!isChatOpen); 
                }} 
                className={cn(
                  "w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-2xl transition-all", 
                  (!limits.AI_ENABLED || !user) ? "opacity-40 grayscale hover:opacity-100 transition-opacity" : isChatOpen ? "bg-[var(--accent)] text-white shadow-[0_0_20px_var(--accent-glow)]" : "text-[var(--accent)] hover:bg-[var(--accent)]/10"
                )}
              >
                {(!limits.AI_ENABLED || !user) ? <EyeOff className="w-4 h-4" /> : isChatOpen ? <Eye className="w-4 h-4" /> : <EyeClosed className="w-4 h-4" />}
              </button>
            </div>
          )}

          <div className="relative group">
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
              <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Physics</span>
                <div className="w-[1px] h-2 bg-white/10 mx-0.5" />
                <span className={cn("text-[8px] font-black uppercase tracking-widest", performanceMode ? "text-amber-400" : activeSpace?.physics ? "text-green-400" : "text-slate-400")}>
                  {performanceMode ? "Auto-Disabled" : activeSpace?.physics ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
            <button 
              onClick={handleTogglePhysics} 
              disabled={performanceMode}
              className={cn(
                "w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-2xl transition-all", 
                performanceMode ? "text-slate-500 opacity-30 cursor-not-allowed" : activeSpace?.physics ? "bg-amber-500/10 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.1)]" : "text-slate-500 hover:bg-white/5"
              )}
            >
              <Zap className={cn("w-4 h-4", activeSpace?.physics && !performanceMode && "fill-current")} />
            </button>
          </div>

          <div className="relative group">
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
              <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Performance</span>
                <div className="w-[1px] h-2 bg-white/10 mx-0.5" />
                <span className={cn("text-[8px] font-black uppercase tracking-widest", performanceMode ? "text-blue-400" : "text-slate-400")}>
                  {performanceMode ? "Efficiency" : "High Quality"}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setPerformanceMode(!performanceMode)}
              className={cn(
                "w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-2xl transition-all", 
                performanceMode ? "bg-blue-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]" : "text-slate-500 hover:bg-white/5"
              )}
            >
              <Gauge className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Interface Cluster: Shortcuts, Help, Menu */}
        <div className="flex items-center gap-1.5 glass p-1.5 rounded-[1.5rem] border border-white/5">
          <button onClick={() => setIsShortcutsOpen(!isShortcutsOpen)} className={cn("group relative hidden md:flex w-10 h-10 md:w-11 md:h-11 items-center justify-center rounded-2xl transition-all", isShortcutsOpen ? "bg-white/10 text-white" : "text-slate-400 hover:text-white")}><div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">Command Center</span></div></div><Keyboard className="w-4 h-4" /></button>
          <button onClick={() => setIsHelpOpen(!isHelpOpen)} className={cn("group relative w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-2xl transition-all", isHelpOpen ? "bg-white/10 text-white" : "text-slate-400 hover:text-white")}><div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">Help</span></div></div><CircleHelp className="w-4 h-4" /></button>
          <button onClick={() => setIsSystemMenuOpen(!isSystemMenuOpen)} className={cn("group relative w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-2xl transition-all", isSystemMenuOpen ? "bg-white/10 text-white" : "text-slate-400 hover:text-white")}><div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">System Menu</span></div></div><MoreVertical className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
};
