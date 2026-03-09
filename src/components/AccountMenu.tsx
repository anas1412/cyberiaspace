import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useStore } from '../store/useStore';
import { useSyncStore } from '../store/useSyncStore';
import { PLAN_CONFIG } from '../constants';
import { useModalStore } from '../store/useModalStore';
import { LogOut, Cloud, CloudOff, RefreshCw, ChevronDown, Trash2, Power, Database, WifiOff, Zap, Star, CreditCard, Calendar, LogIn } from 'lucide-react';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatStorage = (mb: number) => {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
};

const AccountMenu: React.FC = () => {
  const authStore = useAuthStore();
  const lastSyncTime = useSyncStore((state) => state.lastSyncTime);
  const syncStatus = useSyncStore((state) => state.status);
  
  const { 
    user, status, signOut, 
    syncData, autoSync, setAutoSync, deleteCloudData, 
    storageUsageMB, calculateUsage, isOnline
  } = authStore;
  
  const totalThoughtCount = useStore((state) => state.totalThoughtCount);
  const { openModal, openPricing } = useModalStore();

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleNavigateToLogin = () => {
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  useEffect(() => {
    calculateUsage(totalThoughtCount);
  }, [totalThoughtCount, calculateUsage]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[AccountMenu] handleSync called', { syncStatus, isOnline });
    if (syncStatus === 'syncing' || !isOnline) {
      console.log('[AccountMenu] Sync skipped', { reason: syncStatus === 'syncing' ? 'already syncing' : 'offline' });
      return;
    }
    try {
      await syncData();
    } catch (err) {
      console.error('[AccountMenu] Sync failed:', err);
    }
  };

  const handleClearCloudData = () => {
    openModal({
      title: 'Clear Cloud Backup?',
      description: 'This will permanently delete your workspace backup from the cloud. Your local data will remain intact.',
      type: 'delete_thought',
      confirmText: 'Clear Backup',
      onConfirm: async () => {
        await deleteCloudData();
        setIsOpen(false);
      }
    });
  };
  
  const handleManageSubscription = async () => {
    try {
      const accessToken = authStore.accessToken;
      if (!accessToken) return;
      
      const res = await fetch('/api/pay?action=polar_portal', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
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

  const [now] = useState(() => new Date());

  if (status === 'unauthenticated' || !user) {
    return (
      <button
        onClick={handleNavigateToLogin}
        disabled={status === 'loading'}
        className="h-[48px] px-6 glass rounded-2xl border border-white/5 shadow-2xl hover:bg-white/10 text-white flex items-center justify-center gap-3 group pointer-events-auto active:scale-95 transition-all"
      >
        <LogIn className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">Sign In</span>
        {status === 'loading' && <RefreshCw className="ml-1 w-3.5 h-3.5 animate-spin text-white/50" />}
      </button>
    );
  }

  const expiryDate = user?.expiryDate ? new Date(user.expiryDate) : null;
  const daysRemaining = expiryDate 
    ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 3;
  const isExpired = daysRemaining !== null && daysRemaining <= 0;

  return (
    <div className="relative pointer-events-auto" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-[48px] px-2 glass rounded-2xl border border-white/5 shadow-2xl transition-all flex items-center gap-2 group",
          isOpen ? "bg-white/10" : "hover:bg-white/5"
        )}
      >
        <div className="relative">
          <img 
            src={user?.avatar} 
            alt={user?.name} 
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-xl border border-white/10 shadow-lg"
          />
          <div className={cn(
            "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#020408] shadow-sm",
            !isOnline ? "bg-slate-500" :
            syncStatus === 'synced' ? "bg-green-500" : 
            syncStatus === 'syncing' ? "bg-blue-500 animate-pulse" : "bg-amber-500"
          )} />
        </div>

        <ChevronDown className={cn("w-3.5 h-3.5 text-slate-500 transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-64 md:w-72 glass rounded-[1.5rem] md:rounded-[2rem] border border-white/10 shadow-2xl p-4 md:p-5 animate-in fade-in slide-in-from-top-2 duration-300 z-[10000]">
          <div className="flex items-center gap-3 mb-4">
            <img 
              src={user?.avatar} 
              alt={user?.name} 
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-xl border border-white/10 shadow-xl"
            />
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center gap-2 mb-0.5">
                <h4 className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-white truncate">{user?.name}</h4>
                <div className={cn(
                  "px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border shrink-0",
                  user?.plan === 'pro' ? "bg-blue-500/20 border-blue-500/30 text-blue-400" : "bg-slate-500/20 border-slate-500/30 text-slate-400"
                )}>
                  {user?.plan === 'pro' ? 'PRO' : 'FREE'}
                </div>
              </div>
              <p className="text-[8px] md:text-[9px] font-medium text-slate-500 truncate w-full">{user?.email}</p>
            </div>
          </div>

          {user?.plan === 'pro' ? (
            <div className="mb-4 p-3 rounded-2xl bg-blue-500/5 border border-blue-500/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-3 h-3 text-blue-400" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">Pro Access</span>
                </div>
                <span className={cn(
                  "text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md",
                  (user?.subscriptionStatus === 'active' || user?.subscriptionStatus === 'trialing') 
                    ? "bg-green-500/10 text-green-400" 
                    : (user?.subscriptionStatus === 'past_due' || user?.subscriptionStatus === 'unpaid')
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-red-500/10 text-red-400"
                )}>
                  {user?.subscriptionStatus ? (user.subscriptionStatus.charAt(0).toUpperCase() + user.subscriptionStatus.slice(1)) : 'None'}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className={cn("w-3 h-3", isExpired ? "text-red-400" : isExpiringSoon ? "text-amber-400" : "text-slate-500")} />
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-widest",
                  isExpired ? "text-red-400" : isExpiringSoon ? "text-amber-400" : "text-slate-500"
                )}>
                  {user?.expiryDate 
                    ? `Expires: ${new Date(user.expiryDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}` 
                    : 'Lifetime Access'}
                  {(isExpiringSoon || isExpired) && daysRemaining !== null && (
                    <span className="ml-1 text-[7px] opacity-80">
                      ({isExpired ? 'Expired' : `${daysRemaining}d left`})
                    </span>
                  )}
                </span>
              </div>
              {user?.paymentProvider === 'polar' ? (
                <button 
                  onClick={() => {
                    handleManageSubscription();
                    setIsOpen(false);
                  }}
                  className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-blue-500/20"
                >
                  Manage Subscription
                </button>
              ) : (
                <button 
                  onClick={() => {
                    openPricing();
                    setIsOpen(false);
                  }}
                  className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-blue-500/20"
                >
                  {isExpired ? 'Renew Access' : 'Extend Access'}
                </button>
              )}
            </div>

          ) : (
            <button 
              onClick={() => {
                openPricing();
                setIsOpen(false);
              }}
              className="w-full mb-4 flex items-center justify-between p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-blue-400 animate-pulse" />
                <div className="text-left">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white">Upgrade to Pro</p>
                  <p className="text-[7px] font-bold text-blue-400/70 uppercase tracking-widest">Unlock Oracle & More Spaces</p>
                </div>
              </div>
              <Star className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
            </button>
          )}

          <div className="space-y-1 mb-4">
            <div className={cn(
              "flex items-center justify-between p-2.5 rounded-xl md:rounded-2xl border transition-all",
              !isOnline ? "bg-red-500/5 border-red-500/10" : "bg-white/[0.03] border-white/[0.05]"
            )}>
              <div className="flex items-center gap-2.5">
                {!isOnline ? (
                  <WifiOff className="w-3.5 h-3.5 text-red-400" />
                ) : syncStatus === 'synced' ? (
                  <Cloud className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <CloudOff className="w-3.5 h-3.5 text-slate-400" />
                )}
                <div>
                  <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-white">
                    {!isOnline ? 'Network Offline' : 'Cloud Sync'}
                  </p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    {!isOnline ? 'Changes saved locally' : lastSyncTime ? `Last: ${lastSyncTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not synced yet'}
                  </p>
                </div>
              </div>
              <button 
                onClick={handleSync}
                disabled={!isOnline || syncStatus === 'syncing'}
                className={cn(
                  "p-1.5 hover:bg-white/10 rounded-lg transition-all disabled:opacity-20",
                  syncStatus === 'syncing' && "animate-spin"
                )}
                title={isOnline ? "Sync Now" : "Connect to internet to sync"}
              >
                <RefreshCw className="w-3 h-3 text-slate-400" />
              </button>
            </div>

            <button 
              onClick={() => setAutoSync(!autoSync)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl md:rounded-2xl hover:bg-white/5 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Power className={cn("w-3.5 h-3.5 transition-colors", autoSync ? "text-blue-400" : "text-slate-500")} />
                <div className="text-left">
                  <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-white">Auto-Sync</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{autoSync ? 'Always active' : 'Manual only'}</p>
                </div>
              </div>
              <div className={cn(
                "w-7 h-3.5 rounded-full p-1 transition-colors relative",
                autoSync ? "bg-blue-500" : "bg-slate-700"
              )}>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full bg-white transition-transform",
                  autoSync ? "translate-x-3.5" : "translate-x-0"
                )} />
              </div>
            </button>
          </div>
          

          {/* Storage */}
          <div className="px-2.5 mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-2">
                <Database className="w-2.5 h-2.5 text-slate-500" />
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Storage</span>
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
                  storageUsageMB > PLAN_CONFIG[user?.plan || 'free'].MAX_STORAGE_MB * 0.9 ? "bg-red-500" : storageUsageMB > PLAN_CONFIG[user?.plan || 'free'].MAX_STORAGE_MB * 0.7 ? "bg-amber-500" : "bg-[var(--accent)]"
                )}
                style={{ width: `${Math.min((storageUsageMB / PLAN_CONFIG[user?.plan || 'free'].MAX_STORAGE_MB) * 100, 100)}%` }}
              />
            </div>
          </div>


          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={handleClearCloudData}
              disabled={syncStatus === 'syncing' || !lastSyncTime || !isOnline}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg md:rounded-xl hover:bg-red-500/10 text-red-500/60 hover:text-red-400 text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all border border-transparent hover:border-red-500/10 disabled:opacity-30"
              title="Delete cloud data only"
            >

              <Trash2 className="w-3 h-3" />
              Clear
            </button>
            <button
              onClick={() => {
                signOut();
                setIsOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg md:rounded-xl bg-white/5 hover:bg-white/10 text-white text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all border border-white/10"
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2 border-t border-white/5 opacity-40">
            <button 
              onClick={() => {
                window.history.pushState({}, '', '/privacy');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              Privacy Policy
            </button>
            <span className="w-0.5 h-0.5 rounded-full bg-white/20" />
            <button 
              onClick={() => {
                window.history.pushState({}, '', '/terms');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              Terms of Service
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


export default AccountMenu;
