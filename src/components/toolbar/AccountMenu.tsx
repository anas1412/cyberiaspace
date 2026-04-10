import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useSyncStore } from '../../store/useSyncStore';
import { useModalStore } from '../../store/useModalStore';
import { useStore } from '../../store/useStore';
import { PLAN_CONFIG, type SubscriptionPlan } from '../../constants';
import { 
  LogOut, Cloud, CloudOff, RefreshCw, 
  Database, WifiOff, CreditCard, User, 
  ChevronDown, ExternalLink, Zap
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
  const { user, status, signOut, syncData, storageUsageMB, calculateUsage, isOnline, accessToken } = useAuthStore();
  const { lastSyncTime, status: syncStatus } = useSyncStore();
  const totalThoughtCount = useStore((state) => state.totalThoughtCount);
  const { openModal } = useModalStore();

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

  if (status !== 'authenticated' || !user) {
    return (
      <button
        onClick={handleNavigateToLogin}
        className="h-[44px] px-5 glass backdrop-blur-xl rounded-2xl border border-[var(--glass-border)] shadow-lg shadow-[var(--glass-border)] text-[var(--text-dimmed)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-all flex items-center gap-3 group pointer-events-auto"
      >
        <User className="w-4 h-4 group-hover:scale-110 transition-transform" />
        <span className="text-[12px] font-semibold tracking-wide">Account</span>
      </button>
    );
  }

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
        <div className="relative">
          <img 
            src={user.avatar} 
            alt={user.name} 
            referrerPolicy="no-referrer"
            className="w-7 h-7 rounded-lg border border-[var(--glass-border)] shadow-sm"
          />
          <div className={cn(
            "absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-page)]",
            !isOnline ? "bg-slate-500" :
            syncStatus === 'synced' ? "bg-green-500" : 
            syncStatus === 'syncing' ? "bg-blue-500 animate-pulse" : "bg-amber-500"
          )} />
        </div>
        
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold tracking-wider text-[var(--text-primary)] truncate max-w-[100px]">
              {user.name}
            </span>
            {user.plan === 'pro' && (
              <span className="px-0.5 py-px rounded-[3px] bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] text-[9px] font-semibold tracking-wide">
                PRO
              </span>
            )}
          </div>
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
            className="absolute top-full right-0 mt-2 w-72 glass backdrop-blur-xl rounded-2xl border border-[var(--glass-border)] shadow-2xl overflow-hidden z-[10002]"
          >
            <div className="p-5">
              {/* Profile Section */}
              <div className="flex items-center gap-4 mb-6">
                <img 
                  src={user.avatar} 
                  alt={user.name} 
                  className="w-12 h-12 rounded-xl border border-[var(--glass-border)] shadow-xl"
                />
                <div className="flex-1 overflow-hidden">
                  <h4 className="text-[13px] font-semibold tracking-wide text-[var(--text-primary)] truncate">{user.name}</h4>
                  <p className="text-[12px] font-medium text-[var(--text-muted)] truncate">{user.email}</p>
                  
                  {user.plan === 'pro' && user.expiryDate && (
                    <p className="text-[12px] font-medium text-[var(--accent)] mt-1">
                      Pro expires {new Date(user.expiryDate).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Button Section */}
              <div className="mb-6">
                {user.plan === 'pro' ? (
                  user.paymentProvider === 'polar' && (
                    <button
                      onClick={handleManageSubscription}
                      className="w-full flex items-center justify-center gap-2 px-4 h-9 rounded-xl bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 text-[var(--accent)] transition-all border border-[var(--accent)]/20 shadow-inner group"
                    >
                      <CreditCard className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      <span className="text-[12px] font-semibold tracking-wide">Manage Plan</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                    </button>
                  )
                ) : (
                  <button 
                    onClick={() => { window.location.href = '/pricing'; }}
                    className="w-full flex items-center justify-center gap-2.5 px-4 h-9 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 transition-all border border-amber-500/20 shadow-inner group"
                  >
                    <Zap className="w-3.5 h-3.5 fill-amber-500/20 transition-transform animate-pulse group-hover:scale-110" />
                    <span className="text-[12px] font-semibold tracking-wide">Upgrade to Pro</span>
                  </button>
                )}
              </div>

              {/* Sync & Storage Section */}
              <div className="space-y-4 mb-6">
                <p className="text-[12px] font-semibold tracking-wide text-[var(--text-muted)]">Sync & Storage</p>
                
                <div className={cn(
                  "flex items-center justify-between p-3 rounded-xl border transition-all",
                  !isOnline ? "bg-red-500/5 border-red-500/10" : "bg-[var(--glass-bg)] border-[var(--glass-border)]"
                )}>
                  <div className="flex items-center gap-3">
                    {!isOnline ? (
                      <WifiOff className="w-4 h-4 text-red-400" />
                    ) : syncStatus === 'synced' ? (
                      <Cloud className="w-4 h-4 text-green-400" />
                    ) : (
                      <CloudOff className="w-4 h-4 text-[var(--text-dimmed)]" />
                    )}
                    <div>
                      <p className="text-[12px] font-semibold tracking-wide text-[var(--text-primary)]">
                        {!isOnline ? 'Offline' : 'Cloud Sync'}
                      </p>
                      <p className="text-[12px] font-medium text-[var(--text-muted)]">
                        {lastSyncTime ? `Last synced: ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not synced'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={handleSync}
                    disabled={!isOnline || syncStatus === 'syncing'}
                    className={cn(
                      "p-2 hover:bg-[var(--text-primary)]/10 rounded-lg transition-all disabled:opacity-20",
                      syncStatus === 'syncing' && "animate-spin"
                    )}
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[var(--text-dimmed)]" />
                  </button>
                </div>

                <div className="px-1">
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <Database className="w-3 h-3 text-[var(--text-muted)]" />
                      <span className="text-[12px] font-semibold tracking-wide text-[var(--text-dimmed)]">Cloud Storage</span>
                    </div>
                    <span className={cn(
                      "text-[12px] font-semibold tracking-wide",
                      storageUsageMB > limits.MAX_STORAGE_MB ? "text-red-400" : "text-[var(--text-muted)]"
                    )}>
                      {formatStorage(storageUsageMB)} / {formatStorage(limits.MAX_STORAGE_MB)}
                    </span>
                  </div>
                  <div className="h-1 w-full bg-[var(--glass-bg)] rounded-full overflow-hidden border border-[var(--border)]">
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
              <div className="pt-4 border-t border-[var(--border)] space-y-2">
                <button 
                  onClick={() => { signOut(); setIsOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--text-primary)]/5 text-[12px] font-semibold tracking-wide text-[var(--text-primary)] transition-colors group"
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
