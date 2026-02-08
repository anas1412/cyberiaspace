import React, { useState, useEffect, useRef, useCallback } from 'react';
/** AccountMenu component handles user authentication and cloud synchronization */
import { useAuthStore } from '../store/useAuthStore';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import { useGoogleLogin } from '@react-oauth/google';
import { User, LogOut, Cloud, CloudOff, RefreshCw, ChevronDown, ShieldCheck, Trash2, Power, Database, WifiOff } from 'lucide-react';
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
    cloudUsage, calculateUsage, isOnline, setAuthenticatedUser,
    importCloudData
  } = store;
  
  const totalThoughtCount = useStore((state) => state.totalThoughtCount);
  const importDataManual = useStore((state) => state.importData);
  const { openModal } = useModalStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLoginSuccess = useCallback(async (token: string) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) throw new Error('Failed to fetch profile');
      
      const data = await res.json();
      
      const googleUser = {
        id: data.sub,
        name: data.name,
        email: data.email,
        avatar: data.picture
      };

      await setAuthenticatedUser(googleUser, token);

      // Check for cloud data
      const cloudData = await importCloudData();
      if (cloudData) {
        openModal({
          title: 'Cloud Data Found',
          description: 'We found a workspace backup in the cloud. Would you like to restore it? This will overwrite your local changes.',
          type: 'import_confirm',
          confirmText: 'Restore',
          onConfirm: () => {
            importDataManual(cloudData);
          }
        });
      }
    } catch (error) {
      console.error('Login processing error:', error);
    }
  }, [setAuthenticatedUser, importCloudData, openModal, importDataManual]);

  const googleLogin = useGoogleLogin({
    onSuccess: (response: any) => {
      if (response.access_token) {
        handleLoginSuccess(response.access_token);
      }
    },
    onError: (error: any) => console.error('Login Failed:', error),
    // Use FedCM to avoid the legacy third-party cookie prompt
    use_fedcm_for_prompt: true,
  } as any);

  useEffect(() => {
    if (typeof calculateUsage === 'function') {
      calculateUsage(totalThoughtCount);
    }
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
          importDataManual(cloudData);
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

  const handleDeleteCloudData = async () => {
    openModal({
      title: 'Delete Cloud Data?',
      description: 'Are you sure? This will remove all your data from the cloud. Your local workspace will remain intact.',
      type: 'delete_thought',
      confirmText: 'Delete Cloud Data',
      onConfirm: async () => {
        await deleteCloudData();
        setIsOpen(false);
      }
    });
  };

  if (status === 'unauthenticated' || !user) {
    return (
      <button
        onClick={() => googleLogin()}
        disabled={status === 'loading'}
        className="h-[48px] px-6 glass rounded-2xl border border-white/5 shadow-2xl transition-all hover:bg-white/10 active:scale-95 flex items-center gap-3 group pointer-events-auto"
      >
        <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
          <User className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 group-hover:text-white">Sign In</span>
        {status === 'loading' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />}
      </button>
    );
  }

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
            src={user.avatar} 
            alt={user.name} 
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
              src={user.avatar} 
              alt={user.name} 
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-xl border border-white/10 shadow-xl"
            />
            <div>
              <h4 className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-white">{user.name}</h4>
              <p className="text-[8px] md:text-[9px] font-medium text-slate-500 truncate w-32 md:w-40">{user.email}</p>
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
                  <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
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
                <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-white">Restore Cloud</p>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Download backup</p>
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
                  <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">{autoSync ? 'Always active' : 'Manual only'}</p>
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
            
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl md:rounded-2xl hover:bg-white/5 transition-colors cursor-default">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <div>
                <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-white">Cloud Storage</p>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Secure Data Backup</p>
              </div>
            </div>
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
                cloudUsage > 90 ? "text-red-400" : "text-slate-500"
              )}>{cloudUsage}%</span>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div 
                className={cn(
                  "h-full transition-all duration-500 rounded-full",
                  cloudUsage > 90 ? "bg-red-500" : cloudUsage > 70 ? "bg-amber-500" : "bg-[var(--accent)]"
                )}
                style={{ width: `${cloudUsage}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDeleteCloudData}
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
        </div>
      )}
    </div>
  );
};

export default AccountMenu;