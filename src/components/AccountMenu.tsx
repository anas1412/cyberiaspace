import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useStore } from '../store/useStore';
import { PLAN_CONFIG } from '../constants';
import { useModalStore } from '../store/useModalStore';
import { useGoogleLogin } from '@react-oauth/google';
import { LogOut, Cloud, CloudOff, RefreshCw, ChevronDown, Trash2, Power, Database, WifiOff, Zap, Star, CreditCard, Calendar, HardDrive, Loader2, LogIn } from 'lucide-react';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const AccountMenu: React.FC = () => {
  const store = useAuthStore();
  const { 
    user, status, signOut, syncStatus, lastSync, 
    syncData, autoSync, setAutoSync, deleteCloudData, 
    cloudUsage, calculateUsage, isOnline,
    handleAuthCode, updateSettings,
    importCloudData
  } = store;
  
  const totalThoughtCount = useStore((state) => state.totalThoughtCount);
  const importFullState = useStore((state) => state.importFullState);
  const { openModal, openPricing } = useModalStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle Drive Loading State completion
  useEffect(() => {
    if (status !== 'loading') {
      setIsDriveLoading(false);
    }
  }, [status]);

  const handleNavigateToLogin = () => {
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Drive Opt-in Flow (Additional Scopes)
  const driveLogin = useGoogleLogin({
    onSuccess: (response: any) => {
      if (response.code) {
        handleAuthCode(response.code);
      }
    },
    onError: (error: any) => {
      console.error('Drive Login Failed:', error);
      setIsDriveLoading(false);
    },
    flow: 'auth-code',
    scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
    login_hint: user?.email,
    prompt: 'consent' // Force consent to ensure we get a refresh token with Drive scopes
  } as any);

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
    if (syncStatus === 'syncing' || !isOnline) return;
    await syncData();
  };

  const handleRestore = async () => {
    const cloudData = await importCloudData();
    if (cloudData) {
      openModal({
        title: 'Restore from Cloud?',
        description: 'This will replace your current local workspace with the cloud backup. This cannot be undone.',
        type: 'import_confirm',
        confirmText: 'Restore Now',
        onConfirm: () => {
          importFullState(cloudData);
        }
      });
    } else {
      openModal({
        title: 'No Cloud Data',
        description: 'No workspace backup was found in the cloud for this account.',
        type: 'alert',
        confirmText: 'Got it'
      });
    }
  };

  const handleDisconnectDrive = async () => {
    openModal({
      title: 'Disconnect Google Drive?',
      description: 'This will stop syncing your media and research assets to the cloud. You will remain signed in to your Cyberia account.',
      type: 'confirm_cancel',
      confirmText: 'Disconnect',
      onConfirm: async () => {
        setIsDriveLoading(true);
        try {
          const authStore = useAuthStore.getState();
          // 1. Tell backend to disable drive without revoking the main session token
          await fetch('/api/google-auth?action=disable-drive', {
            headers: { Authorization: `Bearer ${authStore.accessToken}` }
          });
          
          // 2. Update local profile state
          await updateSettings({ driveEnabled: false });
          
          console.log('[Auth] Drive synchronization disabled');
        } catch (e) {
          console.error('Disconnect failed:', e);
        } finally {
          setIsDriveLoading(false);
          setIsOpen(false);
        }
      }
    });
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




  const isDriveActive = user?.settings?.driveEnabled;

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
                  user?.subscriptionStatus === 'active' ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                )}>{user?.subscriptionStatus}</span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-3 h-3 text-slate-500" />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  Expires: {user?.expiryDate ? new Date(user?.expiryDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <button 
                onClick={() => {
                  openPricing();
                  setIsOpen(false);
                }}
                className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl text-[7px] font-black uppercase tracking-widest transition-all border border-blue-500/20"
              >
                Extend Access
              </button>
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

          {/* Persistent Cloud Integrations */}
          <div className="mb-4 space-y-1">
            <div className={cn(
              "w-full flex items-center justify-between p-2.5 rounded-xl border transition-all",
              isDriveActive ? "bg-green-500/5 border-green-500/10" : "bg-white/[0.03] border-white/[0.05]"
            )}>
              <div className="flex items-center gap-2.5">
                <HardDrive className={cn("w-3.5 h-3.5", isDriveActive ? "text-green-400" : "text-slate-500")} />
                <div className="text-left">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white">Google Drive</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    {isDriveActive ? 'Cloud Sync Active' : 'Disconnected'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {isDriveLoading ? (
                  <div className="px-3 py-1.5 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-blue-400/60">Wait...</span>
                  </div>
                ) : isDriveActive ? (
                  <button 
                    onClick={handleDisconnectDrive}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      setIsDriveLoading(true);
                      driveLogin();
                    }}
                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          </div>

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
                    {!isOnline ? 'Changes saved locally' : lastSync ? `Last: ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not synced yet'}
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
              onClick={handleRestore}
              disabled={!isOnline || syncStatus === 'syncing'}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-xl md:rounded-2xl hover:bg-white/5 transition-colors group"
            >
              <Cloud className="w-3.5 h-3.5 text-blue-400" />
              <div className="text-left">
                <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-white">Restore Backup</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Download cloud backup</p>
              </div>
            </button>

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

          {/* Cloud Capacity */}
          <div className="px-2.5 mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-2">
                <Database className="w-2.5 h-2.5 text-slate-500" />
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Cloud Capacity</span>
              </div>
              <span className={cn(
                "text-[8px] font-black tracking-widest",
                cloudUsage > 100 ? "text-red-400 animate-pulse" : cloudUsage > 90 ? "text-red-400" : "text-slate-500"
              )}>
                {user?.usage?.sync_thoughts || 0} / {PLAN_CONFIG[user?.plan || 'free'].MAX_CLOUD_THOUGHTS}
              </span>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div 
                className={cn(
                  "h-full transition-all duration-500 rounded-full",
                  cloudUsage > 90 ? "bg-red-500" : cloudUsage > 70 ? "bg-amber-500" : "bg-[var(--accent)]"
                )}
                style={{ width: `${Math.min(cloudUsage, 100)}%` }}
              />
            </div>
          </div>


          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={handleClearCloudData}
              disabled={syncStatus === 'syncing' || !lastSync || !isOnline}
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

          <div className="flex items-center justify-center gap-4 pt-2 border-t border-white/5 opacity-40">
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
