import React, { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useSyncStore } from '../../store/useSyncStore';
import { useModalStore } from '../../store/useModalStore';
import { PLAN_CONFIG } from '../../constants';
import { 
  MonitorSmartphone, Download, Upload, Camera, EyeOff, Eye, EyeClosed, 
  Keyboard, CircleHelp, RefreshCw, Zap, Gauge, Trash2, 
  LogOut, Cloud, CloudOff, Database, WifiOff, CreditCard, 
  Calendar, LogIn, User, ShieldCheck, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatStorage = (mb: number) => {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
};

interface SystemTrayProps {
  isReadOnly: boolean;
  isChatOpen: boolean;
  setChatOpen: (val: boolean) => void;
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
  performanceMode: boolean;
  setPerformanceMode: (val: boolean) => void;
  customBg: string | null;
  setCustomBg: (bg: File | string | null) => Promise<void>;
  activeSpace: any;
  handleTogglePhysics: () => void;
}

export const SystemTray: React.FC<SystemTrayProps> = ({ 
  isReadOnly, isChatOpen, setChatOpen, 
  isShortcutsOpen, setIsShortcutsOpen, isHelpOpen, setIsHelpOpen, 
  isSystemMenuOpen, setIsSystemMenuOpen, theme, setTheme, 
  deferredPrompt, handleInstall, handleExport, handleScreenshot, handleImport, isCapturing,
  performanceMode, setPerformanceMode,
  customBg, setCustomBg,
  activeSpace, handleTogglePhysics
}) => {
  // Logic from AccountMenu and Store requirements
  const user = useAuthStore((state) => state.user);
  const limits = (user?.plan && user.plan in PLAN_CONFIG) ? PLAN_CONFIG[user.plan as keyof typeof PLAN_CONFIG] : PLAN_CONFIG.free;
  const status = useAuthStore((state) => state.status);
  const signOut = useAuthStore((state) => state.signOut);
  const syncData = useAuthStore((state) => state.syncData);
  const deleteCloudData = useAuthStore((state) => state.deleteCloudData);
  const storageUsageMB = useAuthStore((state) => state.storageUsageMB);
  const calculateUsage = useAuthStore((state) => state.calculateUsage);
  const isOnline = useAuthStore((state) => state.isOnline);
  const accessToken = useAuthStore((state) => state.accessToken);

  const lastSyncTime = useSyncStore((state) => state.lastSyncTime);
  const syncStatus = useSyncStore((state) => state.status);
  
  const totalThoughtCount = useStore((state) => state.totalThoughtCount);
  const clearWorkspace = useStore((state) => state.clearWorkspace);
  const clearLocalData = useStore((state) => state.clearLocalData);

  const { openModal, openPricing } = useModalStore();

  useEffect(() => {
    calculateUsage(totalThoughtCount);
  }, [totalThoughtCount, calculateUsage]);

  const handleNavigateToLogin = () => {
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
    setIsSystemMenuOpen(false);
  };

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (syncStatus === 'syncing' || !isOnline) return;
    try {
      await syncData();
    } catch (err) {
      console.error('[SystemTray] Sync failed:', err);
    }
  };

  const handleClearCloudData = () => {
    openModal({
      title: 'DANGER: Wipe Cloud Backup?',
      description: 'THIS ACTION IS IRREVERSIBLE. This will permanently delete your entire workspace backup from the cloud, including all synced files. Only proceed if you want to start with a fresh slate on all devices.',
      type: 'delete_thought',
      confirmText: 'Wipe Everything',
      onConfirm: async () => {
        await deleteCloudData();
        setIsSystemMenuOpen(false);
        try {
          await syncData();
        } catch (err) {
          console.error('[SystemTray] Post-clear sync failed:', err);
        }
      }
    });
  };
  
  const handleManageSubscription = async () => {
    try {
      if (!accessToken) return;
      const res = await fetch('/api/pay?action=polar_portal', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.customerPortalUrl) {
        window.open(data.customerPortalUrl, '_blank');
      } else {
        openModal({
          title: 'Error',
          description: data.error || 'Failed to open management portal',
          type: 'alert',
          confirmText: 'Got it'
        });
      }
    } catch (err) {
      console.error('Failed to open portal:', err);
      openModal({
        title: 'Error',
        description: 'Failed to connect to payment system. Please try again later.',
        type: 'alert',
        confirmText: 'Got it'
      });
    }
  };

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

    setCustomBg(file);
    e.target.value = '';
  };

  const now = new Date();
  const expiryDate = user?.expiryDate ? new Date(user.expiryDate) : null;
  const daysRemaining = expiryDate 
    ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 3;
  const isExpired = daysRemaining !== null && daysRemaining <= 0;

  return (
    <div className="fixed bottom-4 md:bottom-8 right-4 md:right-8 z-[9999] flex flex-col items-end gap-4 pointer-events-none system-tray-container mobile-bottom-bar-adjust">
      <AnimatePresence>
        {isSystemMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="glass rounded-2xl border border-[var(--glass-border)] shadow-2xl flex flex-col pointer-events-auto w-72 md:w-80 overflow-hidden"
          >
            <div className="max-h-[70vh] md:max-h-[80vh] overflow-y-auto custom-scroll p-4 md:p-5">
              {/* Header (Profile) */}
              <div className="mb-6">
                {status === 'authenticated' && user ? (
                  <div className="flex items-center gap-3">
                    <img 
                      src={user.avatar} 
                      alt={user.name} 
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-xl border border-white/10 shadow-xl"
                    />
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-white truncate">{user.name}</h4>
                        <div className={cn(
                          "px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border shrink-0",
                          user.plan === 'pro' ? "bg-blue-500/20 border-blue-500/30 text-blue-400" : "bg-slate-500/20 border-slate-500/30 text-slate-400"
                        )}>
                          {user.plan === 'pro' ? 'PRO' : 'FREE'}
                        </div>
                      </div>
                      <p className="text-[8px] md:text-[9px] font-medium text-slate-500 truncate w-full">{user.email}</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleNavigateToLogin}
                    disabled={status === 'loading'}
                    className="w-full h-12 px-5 glass rounded-xl border border-white/5 shadow-xl hover:bg-white/10 text-white flex items-center justify-center gap-3 group active:scale-[0.98] transition-all"
                  >
                    <LogIn className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sign In</span>
                    {status === 'loading' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-white/50" />}
                  </button>
                )}

                {status === 'authenticated' && user && user.plan === 'pro' && (
                  <div className="mt-4 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3 h-3 text-blue-400" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">Pro Access</span>
                      </div>
                      <span className={cn(
                        "text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md",
                        (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing') 
                          ? "bg-green-500/10 text-green-400" 
                          : (user.subscriptionStatus === 'past_due' || user.subscriptionStatus === 'unpaid')
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-red-500/10 text-red-400"
                      )}>
                        {user.subscriptionStatus ? (user.subscriptionStatus.charAt(0).toUpperCase() + user.subscriptionStatus.slice(1)) : 'None'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className={cn("w-3 h-3", isExpired ? "text-red-400" : isExpiringSoon ? "text-amber-400" : "text-slate-500")} />
                      <span className={cn(
                        "text-[9px] font-bold uppercase tracking-widest",
                        isExpired ? "text-red-400" : isExpiringSoon ? "text-amber-400" : "text-slate-500"
                      )}>
                        {user.expiryDate 
                          ? `Expires: ${new Date(user.expiryDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}` 
                          : 'Lifetime Access'}
                      </span>
                    </div>
                    {user.paymentProvider === 'polar' ? (
                      <button 
                        onClick={handleManageSubscription}
                        className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-blue-500/20"
                      >
                        Manage Subscription
                      </button>
                    ) : (
                      <button 
                        onClick={() => { openPricing(); setIsSystemMenuOpen(false); }}
                        className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-blue-500/20"
                      >
                        {isExpired ? 'Renew Access' : 'Extend Access'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Section 1: Cloud & Storage */}
              <div className="mb-6">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3">Cloud & Storage</p>
                <div className="space-y-3">
                  <div className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-all",
                    !isOnline ? "bg-red-500/5 border-red-500/10" : "bg-white/[0.03] border-white/[0.05]"
                  )}>
                    <div className="flex items-center gap-3">
                      {!isOnline ? (
                        <WifiOff className="w-4 h-4 text-red-400" />
                      ) : syncStatus === 'synced' ? (
                        <Cloud className="w-4 h-4 text-green-400" />
                      ) : (
                        <CloudOff className="w-4 h-4 text-slate-400" />
                      )}
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-white">
                          {!isOnline ? 'Network Offline' : 'Cloud Sync'}
                        </p>
                        <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                          {!isOnline ? 'Local Mode' : lastSyncTime ? `Last: ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not synced'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={handleSync}
                      disabled={!isOnline || syncStatus === 'syncing' || status !== 'authenticated'}
                      className={cn(
                        "p-2 hover:bg-white/10 rounded-lg transition-all disabled:opacity-20",
                        syncStatus === 'syncing' && "animate-spin"
                      )}
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>

                  <div className="px-1">
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2">
                        <Database className="w-3 h-3 text-slate-500" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Storage Usage</span>
                      </div>
                      <span className={cn(
                        "text-[8px] font-black tracking-widest",
                        storageUsageMB > PLAN_CONFIG[user?.plan || 'free'].MAX_STORAGE_MB ? "text-red-400 animate-pulse" : "text-slate-500"
                      )}>
                        {formatStorage(storageUsageMB)} / {formatStorage(PLAN_CONFIG[user?.plan || 'free'].MAX_STORAGE_MB)}
                      </span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className={cn(
                          "h-full transition-all duration-500 rounded-full",
                          storageUsageMB > PLAN_CONFIG[user?.plan || 'free'].MAX_STORAGE_MB * 0.9 ? "bg-red-500" : storageUsageMB > PLAN_CONFIG[user?.plan || 'free'].MAX_STORAGE_MB * 0.7 ? "bg-amber-500" : "bg-blue-500"
                        )}
                        style={{ width: `${Math.min((storageUsageMB / PLAN_CONFIG[user?.plan || 'free'].MAX_STORAGE_MB) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Workspace Settings */}
              {!isReadOnly && (
                <div className="mb-6">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3">Workspace Settings</p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-2">
                      {(['cyberia', 'sea', 'forest', 'rain'] as const).map((id) => {
                        const labels = { cyberia: 'Space', sea: 'Sea', forest: 'Forest', rain: 'Rain' };
                        const colors = { cyberia: '#6366f1', sea: '#00b4d8', forest: '#2dce89', rain: '#d6d3d1' };
                        return (
                          <button 
                            key={id} 
                            onClick={() => setTheme(id)} 
                            className={cn(
                              "flex flex-col items-center gap-2 p-2 rounded-xl border transition-all", 
                              theme === id ? "bg-white/10 border-white/20 shadow-lg" : "border-transparent hover:bg-white/5"
                            )}
                          >
                            <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: colors[id] }} />
                            <span className={cn("text-[7px] font-black uppercase tracking-widest", theme === id ? "text-white" : "text-slate-500")}>
                              {labels[id]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Custom Background</span>
                        {customBg && (
                          <button 
                            onClick={() => setCustomBg(null)}
                            className="text-[8px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <label className="flex items-center justify-center gap-3 px-3 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer transition-all group">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 group-hover:text-white">
                            {customBg ? 'Change Image' : 'Upload Image / GIF'}
                          </span>
                          <span className="text-[7px] font-bold text-slate-600 uppercase tracking-widest">Max 2MB</span>
                        </div>
                        <input type="file" className="hidden" accept="image/*,.gif" onChange={handleBgUpload} />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 3: Tools */}
              <div className="mb-6">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3">Tools</p>
                <div className="grid grid-cols-1 gap-1">
                  {deferredPrompt && (
                    <button onClick={handleInstall} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-[9px] font-black uppercase tracking-widest text-blue-400 transition-all border border-blue-500/20 mb-1">
                      <MonitorSmartphone className="w-3.5 h-3.5" /> Install App
                    </button>
                  )}
                  <button onClick={handleExport} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-300 transition-colors">
                    <Download className="w-3.5 h-3.5 text-slate-500" /> Export backup
                  </button>
                  <label className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-300 transition-colors cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-slate-500" /> Import backup
                    <input type="file" className="hidden" accept=".json" onChange={handleImport} />
                  </label>
                  <button onClick={handleScreenshot} disabled={isCapturing} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-300 transition-colors">
                    <Camera className="w-3.5 h-3.5 text-slate-500" /> {isCapturing ? 'Saving...' : 'Screenshot'}
                  </button>
                </div>
              </div>

              {/* Section 4: Danger Zone */}
              <div className="mb-6">
                <p className="text-[9px] font-black uppercase tracking-widest text-red-500/50 mb-3">Danger Zone</p>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => { 
                      openModal({ 
                        title: 'Factory Reset App?', 
                        description: 'This will clear your local session and log you out. Your cloud data remains safe and can be restored by signing in again.', 
                        type: 'reset_confirm', 
                        confirmText: 'Reset Local', 
                        onConfirm: () => clearLocalData() 
                      }); 
                      setIsSystemMenuOpen(false); 
                    }} 
                    className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl hover:bg-red-500/10 text-[8px] font-black uppercase tracking-widest text-red-400 transition-colors border border-transparent hover:border-red-500/10"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> 
                    <span>Reset Local</span>
                  </button>
                  <button 
                    onClick={() => { 
                      openModal({ 
                        title: 'Clear Workspace?', 
                        description: 'This will permanently delete ALL local data. This action is irreversible.', 
                        type: 'reset_confirm', 
                        confirmText: 'Wipe Local', 
                        onConfirm: () => clearWorkspace() 
                      }); 
                      setIsSystemMenuOpen(false); 
                    }} 
                    className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl hover:bg-red-500/10 text-[8px] font-black uppercase tracking-widest text-red-400 transition-colors border border-transparent hover:border-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 
                    <span>Clear Workspace</span>
                  </button>
                  <button
                    onClick={handleClearCloudData}
                    disabled={syncStatus === 'syncing' || !lastSyncTime || !isOnline || status !== 'authenticated'}
                    className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl hover:bg-red-500/10 text-[8px] font-black uppercase tracking-widest text-red-400 transition-colors border border-transparent hover:border-red-500/10 disabled:opacity-20"
                  >
                    <CloudOff className="w-3.5 h-3.5" />
                    <span>Clear Cloud</span>
                  </button>
                  <button
                    onClick={() => {
                      signOut();
                      setIsSystemMenuOpen(false);
                    }}
                    disabled={status !== 'authenticated'}
                    className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl hover:bg-white/5 text-[8px] font-black uppercase tracking-widest text-slate-300 transition-colors border border-transparent hover:border-white/5 disabled:opacity-20"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-center gap-3 pt-4 border-t border-white/5">
                <button 
                  onClick={() => {
                    window.history.pushState({}, '', '/privacy');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                >
                  <ShieldCheck className="w-2.5 h-2.5" /> Privacy
                </button>
                <span className="w-1 h-1 rounded-full bg-white/10" />
                <button 
                  onClick={() => {
                    window.history.pushState({}, '', '/terms');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                >
                  <FileText className="w-2.5 h-2.5" /> Terms
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3 pointer-events-auto">
        {/* Upgrade Cluster - visible only to Free users */}
        {user?.plan !== 'pro' && (
          <div className="flex items-center gap-1.5 glass p-1 rounded-2xl border border-blue-500/20 h-[48px] bg-blue-500/5 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
            <div className="relative group">
              <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
                <div className="glass px-3 py-1.5 rounded-xl border border-blue-500/20 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Unlock Pro Features</span>
                </div>
              </div>
              <button 
                onClick={openPricing}
                className="flex items-center gap-2.5 px-3 h-9 md:h-10 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 transition-all border border-blue-500/20 group/upgrade shadow-inner"
              >
                <Zap className="w-3.5 h-3.5 fill-blue-500/20 group-hover:scale-110 transition-transform animate-pulse" />
                <span className="hidden md:block text-[9px] font-black uppercase tracking-[0.2em]">Upgrade</span>
              </button>
            </div>
          </div>
        )}

        {/* Engine Cluster: Intelligence, Physics, Performance */}
        <div className="flex items-center gap-1.5 glass p-1 rounded-2xl border border-white/5 h-[48px]">
          {/* Ask Oracle disabled */}
          {!isReadOnly && (
            <div className="relative group">
              <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
                <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                    {status !== 'authenticated' ? 'Sign in to ask Oracle' : 'Ask Oracle'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => { 
                  if (status !== 'authenticated') {
                    handleNavigateToLogin();
                    return;
                  }
                  if (!limits.AI_ENABLED) { openPricing(); return; } 
                  setChatOpen(!isChatOpen); 
                }} 
                className={cn(
                  "w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl transition-all", 
                  (!limits.AI_ENABLED || status !== 'authenticated') ? "opacity-40 grayscale hover:opacity-100 transition-opacity" : isChatOpen ? "bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_0_20px_var(--accent-glow)]" : "text-[var(--accent)] hover:bg-[var(--accent)]/10"
                )}
              >
                {(!limits.AI_ENABLED || status !== 'authenticated') ? <EyeOff className="w-4 h-4" /> : isChatOpen ? <Eye className="w-4 h-4" /> : <EyeClosed className="w-4 h-4" />}
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
                "w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl transition-all", 
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
                "w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl transition-all", 
                performanceMode ? "bg-blue-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]" : "text-slate-500 hover:bg-white/5"
              )}
            >
              <Gauge className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Interface Cluster: Shortcuts, Help, Menu */}
        <div className="flex items-center gap-1.5 glass p-1 rounded-2xl border border-white/5 h-[48px]">
          <button onClick={() => setIsShortcutsOpen(!isShortcutsOpen)} className={cn("group relative hidden md:flex w-9 h-9 md:w-10 md:h-10 items-center justify-center rounded-xl transition-all", isShortcutsOpen ? "bg-white/10 text-white" : "text-slate-400 hover:text-white")}><div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">Command Center</span></div></div><Keyboard className="w-4 h-4" /></button>
          <button onClick={() => setIsHelpOpen(!isHelpOpen)} className={cn("group relative w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl transition-all", isHelpOpen ? "bg-white/10 text-white" : "text-slate-400 hover:text-white")}><div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">Help</span></div></div><CircleHelp className="w-4 h-4" /></button>
          
          <button 
            onClick={() => setIsSystemMenuOpen(!isSystemMenuOpen)} 
            className={cn(
              "group relative w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl transition-all overflow-hidden", 
              isSystemMenuOpen ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
            )}
          >
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
              <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">System Menu</span>
              </div>
            </div>
            {status === 'authenticated' && user ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img 
                  src={user.avatar} 
                  alt={user.name} 
                  className="w-7 h-7 md:w-8 md:h-8 rounded-lg object-cover"
                />
                <div className={cn(
                  "absolute bottom-1 right-1 w-2 h-2 rounded-full border border-[#020408]",
                  !isOnline ? "bg-slate-500" :
                  syncStatus === 'synced' ? "bg-green-500" : 
                  syncStatus === 'syncing' ? "bg-blue-500 animate-pulse" : "bg-amber-500"
                )} />
              </div>
            ) : (
              <User className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
