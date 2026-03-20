import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, MessageSquare, Server, Loader2, Send, MousePointer2,
  Palette, Database, HelpCircle, Laptop, Download, Upload, 
  Camera, RefreshCw, Trash2, X, Info, ExternalLink,
  FileText, Smartphone
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { APP_VERSION, PLAN_CONFIG } from '../../constants';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useModalStore } from '../../store/useModalStore';
import { AccessGuard } from '../common/AccessGuard';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatStorage = (mb: number) => {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
};

// --- Shared Components ---

const ModalHeader: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <div className="flex justify-between items-center px-8 py-6 border-b border-white/5 shrink-0">
    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--accent-secondary)]">{title}</h3>
    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2">
      <X className="w-5 h-5" />
    </button>
  </div>
);

const ModalFooter: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="mt-auto pt-8 pb-10 border-t border-white/5 flex flex-col items-center gap-6 shrink-0 px-8">
    <div className="p-4 rounded-2xl bg-black/20 border border-white/5 flex items-center gap-3 text-left w-full justify-center">
      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
        <Server className="w-4 h-4 text-blue-400" />
      </div>
      <p className="text-xs text-slate-400 font-medium">
        Cyberia Stable Release <span className="text-white font-semibold block sm:inline">Version {APP_VERSION}</span>
      </p>
    </div>
    
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      {[
        { label: 'Privacy Policy', path: '/privacy' },
        { label: 'Terms of Sale (CGV)', path: '/terms' },
        { label: 'Legal Notice', path: '/legal' },
        { label: 'Contact', path: '/contact' }
      ].map((link, idx) => (
        <button 
          key={idx}
          onClick={() => {
            window.history.pushState({}, '', link.path);
            window.dispatchEvent(new PopStateEvent('popstate'));
            onClose();
          }}
          className="text-[11px] font-medium text-slate-500 hover:text-slate-300 transition-colors"
        >
          {link.label}
        </button>
      ))}
    </div>
  </div>
);

// --- Settings Modal ---

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'cyberia' | 'sea' | 'forest' | 'rain' | 'sakura' | null;
  setTheme: (val: 'cyberia' | 'sea' | 'forest' | 'rain' | 'sakura') => void;
  customBg: string | null;
  setCustomBg: (bg: File | string | null) => Promise<void>;
  handleExport: () => void;
  handleImport: (e: any) => void;
  handleScreenshot: () => void;
  isCapturing: boolean;
  deferredPrompt: any;
  handleInstall: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, theme, setTheme, customBg, setCustomBg,
  handleExport, handleImport, handleScreenshot, isCapturing,
  deferredPrompt, handleInstall
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'custom' | 'storage'>('general');
  const { user, storageUsageMB, calculateUsage, updateSettings } = useAuthStore();
  const totalThoughtCount = useStore((state) => state.totalThoughtCount);
  const clearWorkspace = useStore((state) => state.clearWorkspace);
  const clearLocalData = useStore((state) => state.clearLocalData);
  const { openModal } = useModalStore();

  const limits = (user?.plan && user.plan in PLAN_CONFIG) 
    ? PLAN_CONFIG[user.plan as keyof typeof PLAN_CONFIG] 
    : PLAN_CONFIG.free;

  useEffect(() => {
    if (isOpen) calculateUsage(totalThoughtCount);
  }, [isOpen, totalThoughtCount, calculateUsage]);

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

  const handleBgReset = async () => {
    const activeSpaceId = useStore.getState().activeSpaceId;
    if (!activeSpaceId) return;
    
    const { useAuthStore } = await import('../../store/useAuthStore');
    const authStore = useAuthStore.getState();
    const { supabaseStorage } = await import('../../services/supabaseStorage');
    const { db } = await import('../../db');
    
    // Get current customBg from space to revoke blob URL if needed
    const currentSpace = await db.spaces.get(activeSpaceId);
    const currentBg = currentSpace?.customBg;
    
    // Revoke blob URL if it's a local blob
    if (currentBg && currentBg.startsWith('blob:')) {
      URL.revokeObjectURL(currentBg);
    }
    
    // Delete from cloud storage if authenticated
    if (authStore.status === 'authenticated' && authStore.user) {
      try {
        await supabaseStorage.deleteSpaceBackground(authStore.user.id, activeSpaceId);
      } catch (e) {
        console.warn('[BG] Failed to delete background from cloud:', e);
      }
    }
    
    setCustomBg(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 md:p-10 pointer-events-auto" onClick={onClose}>
      <div className="glass max-w-2xl w-full rounded-3xl border border-white/10 flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        
        <ModalHeader title="System Settings" onClose={onClose} />

        {/* Tab Bar */}
        <div className="px-8 pt-6 pb-2 flex gap-2 shrink-0 overflow-x-auto no-scrollbar">
          {[
            { id: 'general', label: 'General', icon: Info },
            { id: 'custom', label: 'Customization', icon: Palette },
            { id: 'storage', label: 'Storage Settings', icon: Database }
          ].map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)} 
              className={cn(
                "relative flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0", 
                activeTab === tab.id ? "text-white" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              )}
            >
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeSettingsTab"
                  className="absolute inset-0 bg-white/10 rounded-xl border border-white/10 shadow-lg"
                  initial={false}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll px-8 py-6">
          <AnimatePresence mode="wait">
            {activeTab === 'general' && (
              <motion.div 
                key="general"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                {/* Internal Navigation */}
                <section>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                    <Info className="w-3.5 h-3.5" /> System Navigation
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button 
                      onClick={() => { onClose(); (window as any)._openShortcuts?.(); }}
                      className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/5 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <MousePointer2 className="w-4 h-4 text-slate-500 group-hover:text-[var(--accent-secondary)] transition-colors" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 group-hover:text-white">Command Center</span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-slate-400" />
                    </button>
                    <button 
                      onClick={() => { onClose(); (window as any)._openHelp?.(); }}
                      className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/5 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <HelpCircle className="w-4 h-4 text-slate-500 group-hover:text-[var(--accent-secondary)] transition-colors" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 group-hover:text-white">System Help</span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-slate-400" />
                    </button>
                  </div>
                </section>

                {/* Help Links (External) */}
                <section>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5" /> Support & Resources
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: 'Feedback Portal', path: '/feedback', icon: MessageSquare },
                      { label: 'App Documentation', path: '/docs', icon: FileText },
                    ].map((link, idx) => (
                      <button 
                        key={idx}
                        onClick={() => { window.open(link.path, '_blank'); }}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <link.icon className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 group-hover:text-white">{link.label}</span>
                        </div>
                        <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-slate-400" />
                      </button>
                    ))}
                  </div>
                </section>

                {/* Tools */}
                <section>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                    <Laptop className="w-3.5 h-3.5" /> Workspace Tools
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={handleExport} className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/5 transition-all text-left group">
                      <Download className="w-4 h-4 text-slate-500 group-hover:text-green-400" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 group-hover:text-white">Export Backup</p>
                        <p className="text-[8px] font-medium text-slate-600 uppercase tracking-widest mt-0.5">Save to JSON</p>
                      </div>
                    </button>
                    <label className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/5 transition-all cursor-pointer group">
                      <Upload className="w-4 h-4 text-slate-500 group-hover:text-blue-400" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 group-hover:text-white">Import Backup</p>
                        <p className="text-[8px] font-medium text-slate-600 uppercase tracking-widest mt-0.5">Restore from JSON</p>
                      </div>
                      <input type="file" className="hidden" accept=".json" onChange={handleImport} />
                    </label>
                    <button onClick={handleScreenshot} disabled={isCapturing} className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/5 transition-all text-left group">
                      <Camera className="w-4 h-4 text-slate-500 group-hover:text-purple-400" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 group-hover:text-white">{isCapturing ? 'Capturing...' : 'Capture Space'}</p>
                        <p className="text-[8px] font-medium text-slate-600 uppercase tracking-widest mt-0.5">High-Res Screenshot</p>
                      </div>
                    </button>
                    {deferredPrompt && (
                      <button onClick={handleInstall} className="flex items-center gap-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-all text-left group">
                        <Smartphone className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 group-hover:text-blue-300">Install Cyberia</p>
                          <p className="text-[8px] font-medium text-blue-500/60 uppercase tracking-widest mt-0.5">Native PWA Experience</p>
                        </div>
                      </button>
                    )}
                  </div>
                </section>
              </motion.div>
            )}

            {activeTab === 'custom' && (
              <motion.div 
                key="custom"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                {/* Themes */}
                {/* App Themes */}
                <section>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                    <Palette className="w-3.5 h-3.5" /> App Themes
                  </p>
                  <AccessGuard 
                    user={user} 
                    mode="disable" 
                    feature="pro"
                    modalTitle="Upgrade to Pro"
                    modalMessage="Unlock custom themes with Pro."
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(['cyberia', 'sea', 'forest', 'rain', 'sakura'] as const).map((id) => {
                        const labels = { cyberia: 'Cyberia', sea: 'Deep Sea', forest: 'Forest', rain: 'Rain', sakura: 'Sakura' };
                        const colors = { cyberia: '#6366f1', sea: '#00b4d8', forest: '#2dce89', rain: '#d6d3d1', sakura: '#f0a8b8' };
                        const active = theme === id;
                        return (
                          <button 
                            key={id} 
                            onClick={() => setTheme(id)} 
                            className={cn(
                              "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all group", 
                              active ? "bg-white/10 border-white/20 shadow-xl" : "bg-white/[0.02] border-white/5 hover:border-white/10"
                            )}
                          >
                            <div 
                              className="w-8 h-8 rounded-full border-4 border-black/20 shadow-lg group-hover:scale-110 transition-transform" 
                              style={{ backgroundColor: colors[id] }} 
                            />
                            <span className={cn("text-[9px] font-black uppercase tracking-widest", active ? "text-white" : "text-slate-500 group-hover:text-slate-300")}>
                              {labels[id]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </AccessGuard>
                </section>

                {/* AI Personality */}
                <section>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5" /> AI Personality
                  </p>
                  <AccessGuard 
                    user={user} 
                    mode="disable" 
                    feature="pro"
                    modalTitle="Upgrade to Pro"
                    modalMessage="Customize your AI personality with Pro."
                  >
                    <textarea 
                      value={user?.settings?.personality || ''}
                      onChange={(e) => updateSettings({ personality: e.target.value })}
                      placeholder="Describe how Oracle should behave..."
                      className="w-full h-24 bg-white/[0.03] border border-white/5 rounded-xl p-4 text-xs text-white outline-none focus:border-[var(--accent)]/50 transition-all resize-none"
                    />
                  </AccessGuard>
                </section>

                {/* Custom Background */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                      <Camera className="w-3.5 h-3.5" /> Workspace Background
                    </p>
                    {customBg && (
                      <button 
                        onClick={handleBgReset}
                        className="text-[9px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3 h-3" /> Reset
                      </button>
                    )}
                  </div>
                  
                  <AccessGuard 
                    user={user} 
                    mode="disable" 
                    feature="pro"
                    modalTitle="Pro Feature"
                    modalMessage="Custom backgrounds require Pro."
                  >
                    <label className="relative flex flex-col items-center justify-center gap-4 p-8 rounded-3xl bg-white/[0.02] border-2 border-dashed border-white/5 hover:border-white/20 hover:bg-white/[0.04] transition-all cursor-pointer group">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 group-hover:bg-white/10 transition-all">
                        <Upload className="w-6 h-6 text-slate-500 group-hover:text-white" />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 group-hover:text-white transition-colors">
                          {customBg ? 'Update Background' : 'Upload Custom Background'}
                        </p>
                        <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1.5">Supports JPG, PNG, GIF • Max 2MB</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*,.gif" onChange={handleBgUpload} />
                    </label>
                  </AccessGuard>
                </section>
              </motion.div>
            )}

            {activeTab === 'storage' && (
              <motion.div 
                key="storage"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                {/* Metrics */}
                <section>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                    <Database className="w-3.5 h-3.5" /> Storage Usage
                  </p>
                  <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <p className="text-[14px] font-black text-white">{formatStorage(storageUsageMB)}</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Used</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-black text-slate-400">{formatStorage(limits.MAX_STORAGE_MB)}</p>
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">Quota Limit</p>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                      <div 
                        className={cn(
                          "h-full transition-all duration-1000 rounded-full",
                          storageUsageMB > limits.MAX_STORAGE_MB * 0.9 ? "bg-red-500" : storageUsageMB > limits.MAX_STORAGE_MB * 0.7 ? "bg-amber-500" : "bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                        )}
                        style={{ width: `${Math.min((storageUsageMB / limits.MAX_STORAGE_MB) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <p className="text-[11px] font-black text-white">{totalThoughtCount}</p>
                        <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Total Thoughts</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <p className="text-[11px] font-black text-white">{Math.round((storageUsageMB / limits.MAX_STORAGE_MB) * 100)}%</p>
                        <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Storage Used</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Data Management */}
                <section>
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-500/50 mb-4 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5" /> Local Management
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button 
                      onClick={() => { 
                        openModal({ 
                          title: 'Factory Reset App?', 
                          description: 'This will clear your local session and log you out. Your cloud data remains safe and can be restored by signing in again.', 
                          type: 'reset_confirm', 
                          confirmText: 'Reset Local', 
                          onConfirm: () => clearLocalData() 
                        }); 
                      }} 
                      className="flex flex-col items-start gap-1 p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-red-500/5 hover:border-red-500/20 transition-all group"
                    >
                      <RefreshCw className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-colors" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 group-hover:text-red-400 mt-2">Reset Session</p>
                      <p className="text-[8px] font-medium text-slate-600 uppercase tracking-widest leading-relaxed mt-1">Clears local cache and logs you out</p>
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
                      }} 
                      className="flex flex-col items-start gap-1 p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-red-500/5 hover:border-red-500/20 transition-all group"
                    >
                      <Trash2 className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-colors" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 group-hover:text-red-400 mt-2">Wipe All Data</p>
                      <p className="text-[8px] font-medium text-slate-600 uppercase tracking-widest leading-relaxed mt-1">Permanently deletes all local thoughts</p>
                    </button>
                  </div>
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ModalFooter onClose={onClose} />
      </div>
    </div>
  );
};

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  setActiveTab: (val: any) => void;
  quickMessage: string;
  setQuickMessage: (val: string) => void;
  quickType: string;
  setQuickType: (val: any) => void;
  isQuickSubmitting: boolean;
  quickSubmitStatus: string;
  handleQuickSubmit: (e: any) => void;
  contactName: string;
  setContactName: (val: string) => void;
  contactEmail: string;
  setContactEmail: (val: string) => void;
  contactMessage: string;
  setContactMessage: (val: string) => void;
  isContactSubmitting: boolean;
  contactSubmitStatus: string;
  handleContactSubmit: (e: any) => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ 
  isOpen, onClose, activeTab, setActiveTab, 
  quickMessage, setQuickMessage, quickType, setQuickType, isQuickSubmitting, quickSubmitStatus, handleQuickSubmit,
  contactName, setContactName, contactEmail, setContactEmail, contactMessage, setContactMessage, isContactSubmitting, contactSubmitStatus, handleContactSubmit
}) => (
  isOpen && (
    <div className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 md:p-10 pointer-events-auto" onClick={onClose}>
      <div className="glass max-w-xl w-full rounded-3xl border border-white/10 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        
        <ModalHeader title="System Help" onClose={onClose} />

        {/* Tabs */}
        <div className="px-8 pt-6 pb-2 flex gap-2 shrink-0 overflow-x-auto no-scrollbar">
          {[{ id: 'about', label: 'About Us' }, { id: 'issue', label: 'Found an Issue?' }, { id: 'contact', label: 'Contact Us' }].map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={cn(
                "relative flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0", 
                activeTab === tab.id ? "text-white" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              )}
            >
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeHelpTab"
                  className="absolute inset-0 bg-white/10 rounded-xl border border-white/10 shadow-lg"
                  initial={false}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
          <AnimatePresence mode="wait">
            {activeTab === 'about' && (
              <motion.div 
                key="about"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <h4 className="text-[11px] font-black text-white uppercase tracking-widest">About Cyberia</h4>
                <p className="text-xs text-slate-400 leading-relaxed italic">Cyberia is a spatial workspace designed for fluid information management. We treat data as physical objects to help you visualize connections and organize your thoughts naturally.</p>
                <p className="text-xs text-slate-500 leading-relaxed">Designed for non-linear thinkers, visionaries, and digital architects. We believe productivity shouldn't feel like a spreadsheet. It should feel like a world.</p>
              </motion.div>
            )}
            
            {activeTab === 'issue' && (
              <motion.div 
                key="issue"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <h4 className="text-[11px] font-black text-white uppercase tracking-widest">Report an Issue</h4>
                {quickSubmitStatus === 'success' ? (
                  <div className="py-6 text-center space-y-3 bg-green-500/5 border border-green-500/10 rounded-2xl animate-in zoom-in-95 duration-300">
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-green-400">Report Transmitted</p>
                  </div>
                ) : (
                  <form onSubmit={handleQuickSubmit} className="space-y-3">
                    <div className="flex gap-1.5 p-1 bg-black/40 border border-white/5 rounded-xl">
                      {(['issue', 'feedback', 'feature'] as const).map((t) => (
                        <button 
                          key={t} 
                          type="button" 
                          onClick={() => setQuickType(t)} 
                          className={cn("flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all", quickType === t ? "bg-white/10 text-white shadow-md border border-white/10" : "text-slate-600 hover:text-slate-400")}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <textarea required value={quickMessage} onChange={(e) => setQuickMessage(e.target.value)} placeholder="Quick report... (System logs will be attached)" className="w-full h-24 bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-white outline-none focus:border-[var(--accent)]/50 transition-all resize-none" />
                    <button type="submit" disabled={isQuickSubmitting || !quickMessage.trim()} className="w-full h-10 bg-[var(--accent)] hover:bg-[var(--accent)]/90 disabled:opacity-50 text-[var(--accent-contrast)] rounded-xl font-black uppercase text-[9px] tracking-widest transition-all flex items-center justify-center gap-2">
                      {isQuickSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3 h-3" /> Send Quick Report</>}
                    </button>
                  </form>
                )}
                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="flex-shrink mx-4 text-[8px] font-black uppercase tracking-widest text-slate-700">OR</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>
                <div className="pt-1">
                  <button onClick={() => window.open('/feedback', '_blank')} className="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/10 transition-all flex items-center justify-center gap-2 group">
                    <MessageSquare className="w-3.5 h-3.5" /> Open Feedback Portal
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'contact' && (
              <motion.div 
                key="contact"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <h4 className="text-[11px] font-black text-white uppercase tracking-widest">Contact Support</h4>
                {contactSubmitStatus === 'success' ? (
                  <div className="py-10 text-center space-y-4 bg-green-500/5 border border-green-500/10 rounded-2xl animate-in zoom-in-95 duration-300">
                    <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-green-400">Message Sent</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">We will get back to you shortly.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black uppercase tracking-widest text-slate-600 ml-1">Name</label>
                        <input type="text" placeholder="Your Name" value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full h-10 bg-black/40 border border-white/5 rounded-xl px-4 text-xs text-white outline-none focus:border-[var(--accent)]/50 transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black uppercase tracking-widest text-slate-600 ml-1">Email</label>
                        <input type="email" required placeholder="your@email.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full h-10 bg-black/40 border border-white/5 rounded-xl px-4 text-xs text-white outline-none focus:border-[var(--accent)]/50 transition-all" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-600 ml-1">Message</label>
                      <textarea required value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} placeholder="How can we help?" className="w-full h-24 bg-black/40 border border-white/5 rounded-xl p-4 text-xs text-white outline-none focus:border-[var(--accent)]/50 transition-all resize-none" />
                    </div>
                    {contactSubmitStatus === 'error' && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-black uppercase tracking-widest text-center">Failed to send message. Please try again.</div>}
                    <button type="submit" disabled={isContactSubmitting || !contactMessage.trim()} className="w-full h-12 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] disabled:opacity-50 text-[var(--accent-contrast)] rounded-xl font-black uppercase text-[10px] tracking-[0.1em] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent)]/10">
                      {isContactSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Send Message</>}
                    </button>
                  </form>
                )}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Support Email</span>
                    <span className="text-[9px] font-bold text-[var(--accent-secondary)]">{import.meta.env.VITE_CONTACT_EMAIL || 'anasbassoumi@gmail.com'}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">System Online</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ModalFooter onClose={onClose} />
      </div>
    </div>
  )
);

export const ShortcutsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => (
  isOpen && (
    <div className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 md:p-10 pointer-events-auto" onClick={onClose}>
      <div className="glass max-w-md w-full rounded-3xl border border-white/10 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        
        <ModalHeader title="Command Center" onClose={onClose} />
        
        <div className="flex-1 overflow-y-auto custom-scroll p-8 space-y-6">
          {[
            { keys: ['Space'], label: 'Create New Thought' }, 
            { keys: ['Del', 'Backspace'], label: 'Delete Selected' },
            { keys: ['Ctrl', 'V'], label: 'Paste (Text, Image, YT)' }, 
            { keys: ['Drag'], label: 'Import (Images, TXT, CSV)' },
            { keys: ['L-Click', 'Drag'], label: 'Pan Viewport' }, 
            { keys: ['Ctrl', 'L-Click'], label: 'Multi-Select (Marquee)' },
            { keys: ['Enter'], label: 'Confirm Modal / Open Editor' }, 
            { keys: ['Wheel'], label: 'Zoom In / Out' },
          ].map((s, i) => (
            <div key={i} className="flex justify-between items-center group">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">{s.label}</span>
              <div className="flex gap-1">
                {s.keys.map(k => (
                  <kbd key={k} className="bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-[9px] font-black text-[var(--accent-secondary)] min-w-[30px] text-center">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
          
          <div className="pt-8 border-t border-white/5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent-secondary)]">
              <MousePointer2 className="w-5 h-5" />
            </div>
            <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500 leading-relaxed">
              Middle-click or Alt+Drag to move around the infinite workspace.
            </p>
          </div>
        </div>

        <ModalFooter onClose={onClose} />
      </div>
    </div>
  )
);
