import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useSyncStore } from '../../store/useSyncStore';
import { useModalStore } from '../../store/useModalStore';
import { useStore } from '../../store/useStore';
import { PLAN_CONFIG, type SubscriptionPlan } from '../../constants';
import { 
  LogOut, Cloud, CloudOff, RefreshCw, 
  Database, WifiOff, CreditCard, User, 
  Trash2, ChevronDown, ExternalLink, Zap
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

export const AccountMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, status, signOut, syncData, deleteCloudData, storageUsageMB, calculateUsage, isOnline, accessToken } = useAuthStore();
  const { lastSyncTime, status: syncStatus } = useSyncStore();
  const totalThoughtCount = useStore((state) => state.totalThoughtCount);
  const { openModal, openPricing } = useModalStore();

  const limits = (user?.plan && user.plan in PLAN_CONFIG) 
    ? PLAN_CONFIG[user.plan as SubscriptionPlan] 
    : PLAN_CONFIG.free;

  useEffect(() => {
    calculateUsage(totalThoughtCount);
  }, [totalThoughtCount, calculateUsage]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isOpen && !target.closest('.account-menu-container')) setIsOpen(false);
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, [isOpen]);

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (syncStatus === 'syncing' || !isOnline) return;
    try {
      await syncData();
    } catch (err) {
      console.error('[AccountMenu] Sync failed:', err);
    }
  };

  const handleNavigateToLogin = () => {
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
    setIsOpen(false);
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

  const handleClearCloudData = () => {
    openModal({
      title: 'DANGER: Wipe Cloud Backup?',
      description: 'THIS ACTION IS IRREVERSIBLE. This will permanently delete your entire workspace backup from the cloud, including all synced files. Only proceed if you want to start with a fresh slate on all devices.',
      type: 'delete_thought',
      confirmText: 'Wipe Everything',
      onConfirm: async () => {
        await deleteCloudData();
        setIsOpen(false);
        try {
          await syncData();
        } catch (err) {
          console.error('[AccountMenu] Post-clear sync failed:', err);
        }
      }
    });
  };

  if (status !== 'authenticated' || !user) {
    return (
      <button
        onClick={handleNavigateToLogin}
        className="h-[48px] px-5 glass rounded-2xl border border-white/5 text-slate-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-3 group pointer-events-auto shadow-sm"
      >
        <User className="w-4 h-4 group-hover:scale-110 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-[0.25em]">Account</span>
      </button>
    );
  }

  return (
    <div className="relative account-menu-container pointer-events-auto">
      {/* Trigger Pill */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-[48px] px-4 glass rounded-2xl border flex items-center gap-3 transition-all group",
          isOpen ? "bg-white/10 border-white/20 shadow-lg" : "border-white/5 hover:border-white/10"
        )}
      >
        <div className="relative">
          <img 
            src={user.avatar} 
            alt={user.name} 
            referrerPolicy="no-referrer"
            className="w-7 h-7 rounded-lg border border-white/10 shadow-sm"
          />
          <div className={cn(
            "absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[#0f172a]",
            !isOnline ? "bg-slate-500" :
            syncStatus === 'synced' ? "bg-green-500" : 
            syncStatus === 'syncing' ? "bg-blue-500 animate-pulse" : "bg-amber-500"
          )} />
        </div>
        
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-white truncate max-w-[100px]">
              {user.name}
            </span>
            {user.plan === 'pro' && (
              <span className="px-1 py-0.5 rounded-[4px] bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[7px] font-black uppercase tracking-widest">
                PRO
              </span>
            )}
          </div>
        </div>

        <ChevronDown className={cn("w-3.5 h-3.5 text-slate-500 transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full right-0 mt-2 w-72 glass rounded-2xl border border-white/10 shadow-2xl overflow-hidden z-[10002]"
          >
            <div className="p-5">
              {/* Profile Section */}
              <div className="flex items-center gap-4 mb-6">
                <img 
                  src={user.avatar} 
                  alt={user.name} 
                  className="w-12 h-12 rounded-xl border border-white/10 shadow-xl"
                />
                <div className="flex-1 overflow-hidden">
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-white truncate">{user.name}</h4>
                  <p className="text-[9px] font-medium text-slate-500 truncate mb-2">{user.email}</p>
                  
                  {user.plan === 'pro' ? (
                    <button 
                      onClick={handleManageSubscription}
                      className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <CreditCard className="w-3 h-3" />
                      Manage Plan
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => { openPricing(); setIsOpen(false); }}
                      className="flex items-center gap-2.5 px-4 h-9 rounded-xl bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 transition-all border border-amber-500/20 shadow-inner"
                    >
                      <Zap className="w-3.5 h-3.5 fill-amber-500/20 transition-transform animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-[0.2em]">Upgrade to Pro</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sync & Storage Section */}
              <div className="space-y-4 mb-6">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Sync & Storage</p>
                
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
                        {!isOnline ? 'Offline' : 'Cloud Sync'}
                      </p>
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                        {lastSyncTime ? `Last: ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not synced'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={handleSync}
                    disabled={!isOnline || syncStatus === 'syncing'}
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
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Cloud Storage</span>
                    </div>
                    <span className={cn(
                      "text-[8px] font-black tracking-widest",
                      storageUsageMB > limits.MAX_STORAGE_MB ? "text-red-400" : "text-slate-500"
                    )}>
                      {formatStorage(storageUsageMB)} / {formatStorage(limits.MAX_STORAGE_MB)}
                    </span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className={cn(
                        "h-full transition-all duration-500 rounded-full",
                        storageUsageMB > limits.MAX_STORAGE_MB * 0.9 ? "bg-red-500" : storageUsageMB > limits.MAX_STORAGE_MB * 0.7 ? "bg-amber-500" : "bg-blue-500"
                      )}
                      style={{ width: `${Math.min((storageUsageMB / limits.MAX_STORAGE_MB) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Actions Section */}
              <div className="pt-4 border-t border-white/5 space-y-2">
                <button 
                  onClick={handleClearCloudData}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-[9px] font-black uppercase tracking-widest text-red-400 transition-colors group"
                >
                  <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  Clear Cloud Database
                </button>
                <button 
                  onClick={() => { signOut(); setIsOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-300 transition-colors group"
                >
                  <LogOut className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  Sign Out
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
