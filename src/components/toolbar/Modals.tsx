import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, MessageSquare, Loader2, Send, MousePointer2,
  Palette, Database, HelpCircle, Laptop, Download, Upload, 
  Camera, RefreshCw, Trash2, X, Info, ExternalLink,
  FileText, Smartphone, Zap
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { APP_VERSION, PLAN_CONFIG, SHOW_QUOTA_TAB, MAX_UPLOAD_SIZE, MAX_UPLOAD_SIZE_MB } from '../../constants';
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
  <div className="flex justify-between items-center px-8 py-6 border-b border-[var(--glass-border)] shrink-0">
    <h3 className="text-sm font-semibold tracking-wide text-[var(--accent-secondary)]">{title}</h3>
    <button onClick={onClose} aria-label="Close modal" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-2">
      <X className="w-5 h-5" />
    </button>
  </div>
);

const ModalFooter: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="mt-auto pt-6 pb-8 border-t border-[var(--glass-border)] flex flex-col items-center gap-4 shrink-0 px-8">
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
          className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          {link.label}
        </button>
      ))}
      <span className="text-[10px] text-[var(--text-muted)] font-medium">v{APP_VERSION}</span>
    </div>
  </div>
);

// --- Settings Modal ---

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customBg: string | null;
  customBgLoading: boolean;
  setCustomBg: (bg: File | string | null) => Promise<void>;
  handleExport: () => void;
  handleImport: (e: any) => void;
  deferredPrompt: any;
  handleInstall: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose, customBg, customBgLoading, setCustomBg,
  handleExport, handleImport,
  deferredPrompt, handleInstall
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'custom' | 'storage' | 'quota'>('general');
  const [quotaPeriod, setQuotaPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [nodeBgKey, setNodeBgKey] = useState(0); // Force re-render for node bg changes
  const [primaryKey, setPrimaryKey] = useState(0); // Force re-render for primary changes
  const [secondaryKey, setSecondaryKey] = useState(0); // Force re-render for secondary changes
  const [localPersonality, setLocalPersonality] = useState('');
  const [personalitySaving, setPersonalitySaving] = useState(false);
  const { user, storageUsageMB, updateSettings, updateQuotaUsage } = useAuthStore();
  const totalThoughtCount = useStore((state) => state.totalThoughtCount);
  const clearWorkspace = useStore((state) => state.clearWorkspace);
  const clearLocalData = useStore((state) => state.clearLocalData);
  const { openModal } = useModalStore();

  const limits = (user?.plan && user.plan in PLAN_CONFIG) 
    ? PLAN_CONFIG[user.plan as keyof typeof PLAN_CONFIG] 
    : PLAN_CONFIG.free;

  // Reset to general tab if user is no longer pro but quota tab was selected
  useEffect(() => {
    if (activeTab === 'quota' && user?.plan !== 'pro') {
      setActiveTab('general');
    }
  }, [user?.plan, activeTab]);

  // Sync local personality state when user settings change
  useEffect(() => {
    setLocalPersonality(user?.settings?.personality || '');
  }, [user?.settings?.personality]);

  // Save personality handler
  const savePersonality = async () => {
    if (!user) return;
    setPersonalitySaving(true);
    try {
      await updateSettings({ personality: localPersonality });
    } finally {
      setPersonalitySaving(false);
    }
  };

  // Fetch fresh usage when quota tab is opened and update centralized auth store
  useEffect(() => {
    if (activeTab === 'quota' && user?.id && user.id !== 'guest') {
      const fetchQuotaUsage = async () => {
        try {
          const { useAuthStore } = await import('../../store/useAuthStore');
          const authStore = useAuthStore.getState();
          const token = await authStore.getOrRefreshToken();
          if (!token) return;
          
          const res = await fetch('/api/chat', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          
          // Update centralized auth store - propagates to all components including ChatOverlay and Settings
          updateQuotaUsage({
            daily_anchor: data.daily_anchor,
            weekly_anchor: data.weekly_anchor,
            monthly_anchor: data.monthly_anchor,
            ai_daily_count: data.count,
            ai_top_count: data.top_count,
            ai_medium_count: data.medium_count,
            ai_small_count: data.small_count,
            weekly_top_count: data.weekly_top_count,
            weekly_medium_count: data.weekly_medium_count,
            weekly_small_count: data.weekly_small_count,
            monthly_top_count: data.monthly_top_count,
            monthly_medium_count: data.monthly_medium_count,
            monthly_small_count: data.monthly_small_count,
          });
        } catch (err) {
          console.error('[Settings] Failed to fetch quota usage:', err);
        }
      };
      fetchQuotaUsage();
    }
  }, [activeTab, user?.id, updateQuotaUsage]);

  // Read from centralized auth store - no local state needed
  const usage = {
    daily: {
      top: user?.usage?.ai_top_count || 0,
      medium: user?.usage?.ai_medium_count || 0,
      small: user?.usage?.ai_small_count || 0,
      free: user?.usage?.ai_daily_count || 0,
    },
    weekly: {
      top: user?.usage?.weekly_top_count || 0,
      medium: user?.usage?.weekly_medium_count || 0,
      small: user?.usage?.weekly_small_count || 0,
    },
    monthly: {
      top: user?.usage?.monthly_top_count || 0,
      medium: user?.usage?.monthly_medium_count || 0,
      small: user?.usage?.monthly_small_count || 0,
    },
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_SIZE) {
      openModal({
        title: 'Background too large',
        description: `Please use an image or GIF under ${MAX_UPLOAD_SIZE_MB}MB.`,
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
    
    const { db } = await import('../../db');
    
    // Get current customBg from space to revoke blob URL if needed
    const currentSpace = await db.spaces.get(activeSpaceId);
    const currentBg = currentSpace?.customBg;
    
    // Revoke blob URL if it's a local blob
    if (currentBg && currentBg.startsWith('blob:')) {
      URL.revokeObjectURL(currentBg);
    }
    
    // Clean up local IndexedDB background (backgrounds are local-only now)
    try {
      await db.spaceBackgrounds.delete(activeSpaceId);
    } catch (e) {
      console.warn('[BG] Failed to delete local background:', e);
    }
    
    setCustomBg(null);
  };

  const handleNodeBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    const alphaColor = color + 'f5'; // Add 96% opacity
    localStorage.setItem('cyberia-node-bg', alphaColor);
    document.documentElement.style.setProperty('--node-bg', alphaColor, 'important');
    setNodeBgKey(prev => prev + 1);
  };

  const handleNodeBgReset = () => {
    localStorage.removeItem('cyberia-node-bg');
    // Remove the !important override, apply theme-appropriate default
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const defaultColor = isDark ? '#12121af5' : '#f8fafc';
    document.documentElement.style.setProperty('--node-bg', defaultColor, 'important');
    setNodeBgKey(prev => prev + 1);
  };

  // Initialize node bg from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('cyberia-node-bg');
    if (stored) {
      // Use !important to override theme-specific values
      document.documentElement.style.setProperty('--node-bg', stored, 'important');
    }
  }, []);

  const getNodeBgColor = () => {
    void nodeBgKey; // Reference to trigger re-render
    return localStorage.getItem('cyberia-node-bg') || '#12121af5';
  };

  const handlePrimaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    localStorage.setItem('cyberia-accent', color);
    document.documentElement.style.setProperty('--accent', color, 'important');
    // Also update secondary accent
    const secondaryColor = color + '99'; // Slightly lighter
    document.documentElement.style.setProperty('--accent-secondary', secondaryColor, 'important');
    setPrimaryKey(prev => prev + 1);
  };

  const handlePrimaryReset = () => {
    localStorage.removeItem('cyberia-accent');
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-secondary');
    setPrimaryKey(prev => prev + 1);
  };

  // Initialize accent from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('cyberia-accent');
    if (stored) {
      document.documentElement.style.setProperty('--accent', stored, 'important');
      document.documentElement.style.setProperty('--accent-secondary', stored + '99', 'important');
    }
  }, []);

  const getPrimaryColor = () => {
    void primaryKey; // Reference to trigger re-render
    return localStorage.getItem('cyberia-accent') || '#6366f1';
  };

  const handleSecondaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    localStorage.setItem('cyberia-secondary', color);
    document.documentElement.style.setProperty('--secondary', color, 'important');
    setSecondaryKey(prev => prev + 1);
  };

  const handleSecondaryReset = () => {
    localStorage.removeItem('cyberia-secondary');
    document.documentElement.style.removeProperty('--secondary');
    setSecondaryKey(prev => prev + 1);
  };

  // Initialize secondary from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('cyberia-secondary');
    if (stored) {
      document.documentElement.style.setProperty('--secondary', stored, 'important');
    }
  }, []);

  const getSecondaryColor = () => {
    void secondaryKey; // Reference to trigger re-render
    return localStorage.getItem('cyberia-secondary') || '#8b5cf6';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10001] bg-[var(--bg-page)]/60 backdrop-blur-md flex items-center justify-center p-6 md:p-10 pointer-events-auto" onClick={onClose}>
      <div className="glass max-w-2xl w-full rounded-3xl border border-[var(--glass-border)] flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        
        <ModalHeader title="System Settings" onClose={onClose} />

        {/* Tab Bar */}
        <div className="px-8 pt-6 pb-2 flex gap-2 shrink-0 overflow-x-auto no-scrollbar">
          {[
            { id: 'general', label: 'General', icon: Info },
            { id: 'custom', label: 'Customization', icon: Palette },
            ...(user?.plan === 'pro' && SHOW_QUOTA_TAB ? [{ id: 'quota', label: 'Quota Usage', icon: Zap }] : []),
            { id: 'storage', label: 'Storage', icon: Database }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "relative flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[10px] font-semibold tracking-wide transition-all shrink-0",
                activeTab === tab.id ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
              )}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeSettingsTab"
                  className="absolute inset-0 bg-[var(--glass-bg)] rounded-xl border border-[var(--glass-border)] shadow-lg"
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

        <div className="flex-1 overflow-y-auto custom-scroll px-8 py-6" onWheel={(e) => e.stopPropagation()}>
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
                  <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] mb-4 flex items-center gap-2">
                    <Info className="w-3.5 h-3.5" /> System Navigation
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => { onClose(); (window as any)._openShortcuts?.(); }}
                      className="flex items-center justify-between p-4 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:bg-[var(--bg-page)] transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <MousePointer2 className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-secondary)] transition-colors" />
                        <span className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)] group-hover:text-[var(--text-primary)]">Command Center</span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--text-dimmed)]" />
                    </button>
                    <button
                      onClick={() => { onClose(); (window as any)._openHelp?.(); }}
                      className="flex items-center justify-between p-4 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:bg-[var(--bg-page)] transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <HelpCircle className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-secondary)] transition-colors" />
                        <span className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)] group-hover:text-[var(--text-primary)]">System Help</span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--text-dimmed)]" />
                    </button>
                  </div>
                </section>

                {/* Help Links (External) */}
                <section>
                  <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] mb-4 flex items-center gap-2">
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
                        className="flex items-center justify-between p-4 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:bg-[var(--bg-page)] hover:border-[var(--glass-border)] transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <link.icon className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                          <span className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)] group-hover:text-[var(--text-primary)]">{link.label}</span>
                        </div>
<ExternalLink className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--text-dimmed)]" />
                      </button>
                    ))}
                  </div>
                </section>

                {/* Tools */}
                <section>
                  <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] mb-4 flex items-center gap-2">
                    <Laptop className="w-3.5 h-3.5" /> Workspace Tools
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={handleExport} className="flex items-center gap-3 p-4 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:bg-[var(--bg-page)] transition-all text-left group">
                      <Download className="w-4 h-4 text-[var(--text-muted)] group-hover:text-green-500" />
                      <div>
                        <p className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)] group-hover:text-[var(--text-primary)]">Export Backup</p>
                        <p className="text-[8px] font-medium text-[var(--text-muted)] uppercase tracking-wide mt-0.5">Save to JSON</p>
                      </div>
                    </button>
                    <label className="flex items-center gap-3 p-4 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:bg-[var(--bg-page)] transition-all cursor-pointer group">
                      <Upload className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)]" />
                      <div>
                        <p className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)] group-hover:text-[var(--text-primary)]">Import Backup</p>
                        <p className="text-[8px] font-medium text-[var(--text-muted)] uppercase tracking-wide mt-0.5">Restore from JSON</p>
                      </div>
                      <input type="file" className="hidden" accept=".json" onChange={handleImport} />
                    </label>
                    {deferredPrompt && (
                      <button onClick={handleInstall} className="flex items-center gap-3 p-4 rounded-2xl bg-[var(--accent)]/5 border border-[var(--accent)]/10 hover:bg-[var(--accent)]/10 transition-all text-left group">
                        <Smartphone className="w-4 h-4 text-[var(--accent)] group-hover:scale-110 transition-transform" />
                        <div>
                          <p className="text-[10px] font-semibold tracking-wide text-[var(--accent)] group-hover:text-[var(--accent-secondary)]">Install Cyberia</p>
                          <p className="text-[8px] font-medium text-[var(--accent)]/60 uppercase tracking-wide mt-0.5">Native PWA Experience</p>
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
                {/* AI Personality */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5" /> AI Personality
                    </p>
                    <AccessGuard 
                      user={user} 
                      mode="disable" 
                      feature="pro"
                      modalTitle="Upgrade to Pro"
                      modalMessage="Customize your AI personality with Pro."
                    >
                      <button
                        onClick={savePersonality}
                        disabled={personalitySaving}
                        className={cn(
                          "text-[9px] font-semibold tracking-wide px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                          localPersonality !== (user?.settings?.personality || '')
                            ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-secondary)]"
                            : "bg-[var(--glass-bg)] text-[var(--text-muted)] cursor-not-allowed"
                        )}
                      >
                        {personalitySaving ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3 h-3" />
                        )}
                        {personalitySaving ? 'Saving...' : 'Save'}
                      </button>
                    </AccessGuard>
                  </div>
                  <AccessGuard 
                    user={user} 
                    mode="disable" 
                    feature="pro"
                    modalTitle="Upgrade to Pro"
                    modalMessage="Customize your AI personality with Pro."
                  >
                    <textarea
                      value={localPersonality}
                      onChange={(e) => setLocalPersonality(e.target.value)}
                      placeholder="Describe how Oracle should behave..."
                      className="w-full h-24 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-4 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-all resize-none"
                    />
                  </AccessGuard>
                </section>

                {/* Custom Background */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] flex items-center gap-2">
                      <Camera className="w-3.5 h-3.5" /> Workspace Background
                    </p>
                    {customBg && !customBgLoading && (
                      <button 
                        onClick={handleBgReset}
                        className="text-[9px] font-semibold tracking-wide text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3 h-3" /> Reset
                      </button>
                    )}
                  </div>
                  
                  {customBgLoading ? (
                    <div className="flex flex-col items-center justify-center gap-4 p-8 rounded-3xl bg-[var(--glass-bg)] border-2 border-dashed border-[var(--accent)]/50">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--bg-page)] flex items-center justify-center animate-pulse">
                        <Upload className="w-6 h-6 text-[var(--accent)]" />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-semibold tracking-wide text-[var(--text-primary)]">Uploading...</p>
                        <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wide mt-1.5">Please wait</p>
                      </div>
                    </div>
                  ) : (
                    <AccessGuard 
                      user={user} 
                      mode="disable" 
                      feature="pro"
                      modalTitle="Pro Feature"
                      modalMessage="Custom backgrounds require Pro."
                    >
                      <label className="relative flex flex-col items-center justify-center gap-4 p-8 rounded-3xl bg-[var(--glass-bg)] border-2 border-dashed border-[var(--glass-border)] hover:border-[var(--accent)]/50 hover:bg-[var(--bg-page)] transition-all cursor-pointer group">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-page)] flex items-center justify-center group-hover:scale-110 group-hover:bg-[var(--glass-bg)] transition-all">
                          <Upload className="w-6 h-6 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)] group-hover:text-[var(--text-primary)] transition-colors">
                            {customBg ? 'Update Background' : 'Upload Custom Background'}
                          </p>
                          <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wide mt-1.5">Supports JPG, PNG, GIF • Max 2MB</p>
                        </div>
                        <input type="file" className="hidden" accept="image/*,.gif" onChange={handleBgUpload} />
                      </label>
                    </AccessGuard>
                  )}
                </section>

                {/* Node Colors */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] flex items-center gap-2">
                      <Palette className="w-3.5 h-3.5" /> Node Colors
                    </p>
                    {getNodeBgColor() !== '#12121af5' && (
                      <button 
                        onClick={handleNodeBgReset}
                        className="text-[9px] font-semibold tracking-wide text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3 h-3" /> Reset
                      </button>
                    )}
                  </div>
                  
                  <div className="p-6 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="relative group">
                        <div 
                          className="w-12 h-12 rounded-xl border-2 border-[var(--glass-border)] overflow-hidden shadow-lg"
                          style={{ backgroundColor: getNodeBgColor() }}
                        />
                        <input
                          type="color"
                          value={getNodeBgColor().slice(0, 7)}
                          onChange={handleNodeBgChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-semibold text-[var(--text-primary)]">Thought Nodes</p>
                        <p className="text-[9px] text-[var(--text-muted)] mt-1">Click the swatch to customize</p>
                      </div>
                      <div 
                        className="px-3 py-1.5 rounded-lg bg-[var(--bg-page)] border border-[var(--glass-border)] text-[10px] font-mono text-[var(--text-muted)]"
                      >
                        {getNodeBgColor().slice(0, 7)}
                      </div>
                    </div>
                    
                    {/* Preset Colors */}
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { color: '#12121a', name: 'Charcoal' },
                        { color: '#0f172a', name: 'Midnight' },
                        { color: '#1e1e2e', name: 'Obsidian' },
                        { color: '#2d1f3d', name: 'Plum' },
                        { color: '#1a2744', name: 'Navy' },
                        { color: '#134e4a', name: 'Teal' },
                      ].map((preset) => (
                        <button
                          key={preset.color}
                          onClick={() => handleNodeBgChange({ target: { value: preset.color } } as any)}
                          className={cn(
                            "w-8 h-8 rounded-lg border-2 transition-all hover:scale-110",
                            getNodeBgColor().slice(0, 7) === preset.color 
                              ? "border-[var(--text-primary)] shadow-lg" 
                              : "border-[var(--glass-border)] hover:border-[var(--accent)]/50"
                          )}
                          style={{ backgroundColor: preset.color }}
                          title={preset.name}
                        />
                      ))}
                    </div>
                  </div>
                </section>

                {/* Primary Color */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] flex items-center gap-2">
                      <Palette className="w-3.5 h-3.5" /> Primary Color
                    </p>
                    {getPrimaryColor() !== '#6366f1' && (
                      <button 
                        onClick={handlePrimaryReset}
                        className="text-[9px] font-semibold tracking-wide text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3 h-3" /> Reset
                      </button>
                    )}
                  </div>
                  
                  <div className="p-6 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="relative group">
                        <div 
                          className="w-12 h-12 rounded-xl border-2 border-[var(--glass-border)] overflow-hidden shadow-lg"
                          style={{ backgroundColor: getPrimaryColor() }}
                        />
                        <input
                          type="color"
                          value={getPrimaryColor()}
                          onChange={handlePrimaryChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-semibold text-[var(--text-primary)]">Brand Primary</p>
                        <p className="text-[9px] text-[var(--text-muted)] mt-1">Click the swatch to customize</p>
                      </div>
                      <div 
                        className="px-3 py-1.5 rounded-lg bg-[var(--bg-page)] border border-[var(--glass-border)] text-[10px] font-mono text-[var(--text-muted)]"
                      >
                        {getPrimaryColor()}
                      </div>
                    </div>
                    
                    {/* Preset Colors */}
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { color: '#6366f1', name: 'Indigo' },
                        { color: '#8b5cf6', name: 'Violet' },
                        { color: '#ec4899', name: 'Pink' },
                        { color: '#f43f5e', name: 'Rose' },
                        { color: '#ef4444', name: 'Red' },
                        { color: '#f97316', name: 'Orange' },
                        { color: '#eab308', name: 'Yellow' },
                        { color: '#22c55e', name: 'Green' },
                        { color: '#14b8a6', name: 'Teal' },
                        { color: '#06b6d4', name: 'Cyan' },
                        { color: '#3b82f6', name: 'Blue' },
                        { color: '#a855f7', name: 'Purple' },
                      ].map((preset) => (
                        <button
                          key={preset.color}
                          onClick={() => handlePrimaryChange({ target: { value: preset.color } } as any)}
                          className={cn(
                            "w-8 h-8 rounded-lg border-2 transition-all hover:scale-110",
                            getPrimaryColor() === preset.color 
                              ? "border-[var(--text-primary)] shadow-lg" 
                              : "border-[var(--glass-border)] hover:border-[var(--text-primary)]/50"
                          )}
                          style={{ backgroundColor: preset.color }}
                          title={preset.name}
                        />
                      ))}
                    </div>
                  </div>
                </section>

                {/* Secondary Color */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] flex items-center gap-2">
                      <Palette className="w-3.5 h-3.5" /> Secondary Color
                    </p>
                    {getSecondaryColor() !== '#8b5cf6' && (
                      <button 
                        onClick={handleSecondaryReset}
                        className="text-[9px] font-semibold tracking-wide text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3 h-3" /> Reset
                      </button>
                    )}
                  </div>
                  
                  <div className="p-6 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="relative group">
                        <div 
                          className="w-12 h-12 rounded-xl border-2 border-[var(--glass-border)] overflow-hidden shadow-lg"
                          style={{ backgroundColor: getSecondaryColor() }}
                        />
                        <input
                          type="color"
                          value={getSecondaryColor()}
                          onChange={handleSecondaryChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-semibold text-[var(--text-primary)]">Progress & Glow</p>
                        <p className="text-[9px] text-[var(--text-muted)] mt-1">Click the swatch to customize</p>
                      </div>
                      <div 
                        className="px-3 py-1.5 rounded-lg bg-[var(--bg-page)] border border-[var(--glass-border)] text-[10px] font-mono text-[var(--text-muted)]"
                      >
                        {getSecondaryColor()}
                      </div>
                    </div>
                    
                    {/* Preset Colors */}
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { color: '#8b5cf6', name: 'Violet' },
                        { color: '#ec4899', name: 'Pink' },
                        { color: '#f43f5e', name: 'Rose' },
                        { color: '#ef4444', name: 'Red' },
                        { color: '#f97316', name: 'Orange' },
                        { color: '#eab308', name: 'Yellow' },
                        { color: '#22c55e', name: 'Green' },
                        { color: '#14b8a6', name: 'Teal' },
                        { color: '#06b6d4', name: 'Cyan' },
                        { color: '#3b82f6', name: 'Blue' },
                        { color: '#6366f1', name: 'Indigo' },
                        { color: '#a855f7', name: 'Purple' },
                      ].map((preset) => (
                        <button
                          key={preset.color}
                          onClick={() => handleSecondaryChange({ target: { value: preset.color } } as any)}
                          className={cn(
                            "w-8 h-8 rounded-lg border-2 transition-all hover:scale-110",
                            getSecondaryColor() === preset.color 
                              ? "border-[var(--text-primary)] shadow-lg" 
                              : "border-[var(--glass-border)] hover:border-[var(--text-primary)]/50"
                          )}
                          style={{ backgroundColor: preset.color }}
                          title={preset.name}
                        />
                      ))}
                    </div>
                  </div>
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
                  <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] mb-4 flex items-center gap-2">
                    <Database className="w-3.5 h-3.5" /> Storage Usage
                  </p>
                  <div className="p-6 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <p className="text-[14px] font-black text-[var(--text-primary)]">{formatStorage(storageUsageMB)}</p>
                        <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide mt-0.5">Used</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-black text-[var(--text-muted)]">{formatStorage(limits.MAX_STORAGE_MB)}</p>
                        <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide mt-0.5">Quota Limit</p>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-[var(--bg-page)] rounded-full overflow-hidden border border-[var(--glass-border)] p-0.5">
                      <div 
                        className={cn(
                          "h-full transition-all duration-1000 rounded-full",
                          storageUsageMB > limits.MAX_STORAGE_MB * 0.9 ? "bg-red-500" : storageUsageMB > limits.MAX_STORAGE_MB * 0.7 ? "bg-amber-500" : "bg-[var(--accent)] shadow-[0_0_15px_var(--accent-glow)]"
                        )}
                        style={{ width: `${Math.min((storageUsageMB / limits.MAX_STORAGE_MB) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-xl bg-[var(--bg-page)] border border-[var(--glass-border)]">
                        <p className="text-[11px] font-black text-[var(--text-primary)]">{totalThoughtCount}</p>
                        <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wide mt-0.5">Total Thoughts</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[var(--bg-page)] border border-[var(--glass-border)]">
                        <p className="text-[11px] font-black text-[var(--text-primary)]">{Math.round((storageUsageMB / limits.MAX_STORAGE_MB) * 100)}%</p>
                        <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wide mt-0.5">Storage Used</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Data Management */}
                <section>
                  <p className="text-[10px] font-semibold tracking-wide text-red-500/50 mb-4 flex items-center gap-2">
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
                      className="flex flex-col items-start gap-1 p-5 rounded-2xl bg-[var(--bg-page)] border border-[var(--glass-border)] hover:bg-red-500/5 hover:border-red-500/20 transition-all group"
                    >
                      <RefreshCw className="w-4 h-4 text-[var(--text-muted)] group-hover:text-red-400 transition-colors" />
                      <p className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)] group-hover:text-red-400 mt-2">Reset Session</p>
                      <p className="text-[8px] font-medium text-[var(--text-muted)] uppercase tracking-wide leading-relaxed mt-1">Clears local cache and logs you out</p>
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
                      className="flex flex-col items-start gap-1 p-5 rounded-2xl bg-[var(--bg-page)] border border-[var(--glass-border)] hover:bg-red-500/5 hover:border-red-500/20 transition-all group"
                    >
                      <Trash2 className="w-4 h-4 text-[var(--text-muted)] group-hover:text-red-400 transition-colors" />
                      <p className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)] group-hover:text-red-400 mt-2">Wipe All Data</p>
                      <p className="text-[8px] font-medium text-[var(--text-muted)] uppercase tracking-wide leading-relaxed mt-1">Permanently deletes all local thoughts</p>
                    </button>
                  </div>
                </section>
              </motion.div>
            )}

            {activeTab === 'quota' && (
              <motion.div 
                key="quota"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Period Tabs */}
                <div className="flex gap-2 mb-4">
                  {(['daily', 'weekly', 'monthly'] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setQuotaPeriod(period)}
className={cn(
                         "px-4 py-2 rounded-lg text-[9px] font-semibold tracking-wide transition-all",
                         quotaPeriod === period
                           ? "bg-[var(--glass-bg)] text-[var(--text-primary)] border border-[var(--glass-border)]"
                           : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                       )}
                    >
                      {period}
                    </button>
                  ))}
                </div>

                {/* Usage Bars - show remaining percentage (100% = full quota remaining, 0% = quota exhausted) */}
                {quotaPeriod === 'daily' && (
                  <>
                    {/* Premium */}
                    <div className="p-4 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[11px] font-bold text-[var(--accent-secondary)]">PREMIUM</span>
                        <span className="text-[14px] font-black text-[var(--text-primary)]">{Math.max(0, 100 - Math.round((usage.daily.top / 15) * 100))}%</span>
                      </div>
                      <div className="h-2 w-full bg-[var(--bg-page)] rounded-full overflow-hidden border border-[var(--glass-border)] p-0.5">
                        <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: `${Math.max(0, Math.min(100, 100 - (usage.daily.top / 15) * 100))}%` }} />
                      </div>
                    </div>

                    {/* Normal */}
                    <div className="p-4 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[11px] font-bold text-[var(--accent-secondary)]">NORMAL</span>
                        <span className="text-[14px] font-black text-[var(--text-primary)]">{Math.max(0, 100 - Math.round((usage.daily.medium / 60) * 100))}%</span>
                      </div>
                      <div className="h-2 w-full bg-[var(--bg-page)] rounded-full overflow-hidden border border-[var(--glass-border)] p-0.5">
                        <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: `${Math.max(0, Math.min(100, 100 - (usage.daily.medium / 60) * 100))}%` }} />
                      </div>
                    </div>

                    {/* Small */}
                    <div className="p-4 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[11px] font-bold text-[var(--accent-secondary)]">SMALL</span>
                        <span className="text-[14px] font-black text-[var(--text-primary)]">{Math.max(0, 100 - Math.round((usage.daily.small / 500) * 100))}%</span>
                      </div>
                      <div className="h-2 w-full bg-[var(--bg-page)] rounded-full overflow-hidden border border-[var(--glass-border)] p-0.5">
                        <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: `${Math.max(0, Math.min(100, 100 - (usage.daily.small / 500) * 100))}%` }} />
                      </div>
                    </div>

{/* Free */}
                    <div className="p-4 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[11px] font-bold text-[var(--text-muted)]">FREE</span>
                        <span className="text-[14px] font-black text-[var(--text-primary)]">{(user?.plan || 'free') === 'pro' ? '∞' : `${Math.max(0, 100 - Math.round((usage.daily.free / 15) * 100))}%`}</span>
                      </div>
                      <div className="h-2 w-full bg-[var(--bg-page)] rounded-full overflow-hidden border border-[var(--glass-border)] p-0.5">
                        <div className="h-full bg-[var(--text-muted)] rounded-full" style={{ width: `${(user?.plan || 'free') === 'pro' ? 100 : Math.max(0, Math.min(100, 100 - (usage.daily.free / 15) * 100))}%` }} />
                      </div>
                    </div>
                  </>
                )}
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
    <div className="fixed inset-0 z-[10001] bg-[var(--bg-page)]/60 backdrop-blur-md flex items-center justify-center p-6 md:p-10 pointer-events-auto" onClick={onClose}>
      <div className="glass max-w-xl w-full rounded-3xl border border-[var(--glass-border)] flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        
        <ModalHeader title="System Help" onClose={onClose} />

        {/* Tabs */}
        <div className="px-8 pt-6 pb-2 flex gap-2 shrink-0 overflow-x-auto no-scrollbar">
          {[{ id: 'about', label: 'About Us' }, { id: 'issue', label: 'Found an Issue?' }, { id: 'contact', label: 'Contact Us' }].map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={cn(
                "relative flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[10px] font-semibold tracking-wide transition-all shrink-0",
                activeTab === tab.id ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
              )}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeHelpTab"
                  className="absolute inset-0 bg-[var(--glass-bg)] rounded-xl border border-[var(--glass-border)] shadow-lg"
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
                <h4 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wide">About Cyberia</h4>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed italic">Cyberia Space is an all-in-one workspace designed for fluid information management. We treat data as physical objects to help you visualize connections and organize your thoughts naturally.</p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">Designed for non-linear thinkers, visionaries, and digital architects. We believe productivity shouldn't feel like a spreadsheet. It should feel like a world.</p>
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
                <h4 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wide">Report an Issue</h4>
                {quickSubmitStatus === 'success' ? (
                  <div className="py-6 text-center space-y-3 bg-green-500/5 border border-green-500/10 rounded-2xl animate-in zoom-in-95 duration-300">
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto" />
                    <p className="text-[10px] font-semibold tracking-wide text-green-400">Report Transmitted</p>
                  </div>
                ) : (
                  <form onSubmit={handleQuickSubmit} className="space-y-3">
                    <div className="flex gap-1.5 p-1 bg-[var(--bg-page)] border border-[var(--glass-border)] rounded-xl">
                      {(['issue', 'feedback', 'feature'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setQuickType(t)}
                          className={cn("flex-1 py-1.5 rounded-lg text-[8px] font-semibold tracking-wide transition-all", quickType === t ? "bg-[var(--glass-bg)] text-[var(--text-primary)] shadow-md border border-[var(--glass-border)]" : "text-[var(--text-muted)] hover:text-[var(--text-dimmed)]")}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <textarea required value={quickMessage} onChange={(e) => setQuickMessage(e.target.value)} placeholder="Quick report... (System logs will be attached)" className="w-full h-24 bg-[var(--bg-page)] border border-[var(--glass-border)] rounded-xl p-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-all resize-none" />
                    <button type="submit" disabled={isQuickSubmitting || !quickMessage.trim()} className="w-full h-10 bg-[var(--accent)] hover:bg-[var(--accent)]/90 disabled:opacity-50 text-[var(--accent-contrast)] rounded-xl font-semibold text-[11px] tracking-wide transition-all flex items-center justify-center gap-2">
                      {isQuickSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3 h-3" /> Send Quick Report</>}
                    </button>
                  </form>
                )}
                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-[var(--glass-border)]"></div>
                  <span className="flex-shrink mx-4 text-[8px] font-semibold tracking-wide text-[var(--text-muted)]">OR</span>
                  <div className="flex-grow border-t border-[var(--glass-border)]"></div>
                </div>
                <div className="pt-1">
                  <button onClick={() => window.open('/feedback', '_blank')} className="w-full px-6 py-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[9px] font-semibold tracking-wide text-[var(--text-dimmed)] hover:bg-[var(--bg-page)] transition-all flex items-center justify-center gap-2 group">
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
                <h4 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wide">Contact Support</h4>
                {contactSubmitStatus === 'success' ? (
                  <div className="py-10 text-center space-y-4 bg-green-500/5 border border-green-500/10 rounded-2xl animate-in zoom-in-95 duration-300">
                    <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                    <div>
                      <p className="text-[10px] font-semibold tracking-wide text-green-400">Message Sent</p>
                      <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide mt-1">We will get back to you shortly.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-semibold tracking-wide text-[var(--text-muted)] ml-1">Name</label>
                        <input type="text" placeholder="Your Name" value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full h-10 bg-[var(--bg-page)] border border-[var(--glass-border)] rounded-xl px-4 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-semibold tracking-wide text-[var(--text-muted)] ml-1">Email</label>
                        <input type="email" required placeholder="your@email.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full h-10 bg-[var(--bg-page)] border border-[var(--glass-border)] rounded-xl px-4 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-all" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-semibold tracking-wide text-[var(--text-muted)] ml-1">Message</label>
                      <textarea required value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} placeholder="How can we help?" className="w-full h-24 bg-[var(--bg-page)] border border-[var(--glass-border)] rounded-xl p-4 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-all resize-none" />
                    </div>
                    {contactSubmitStatus === 'error' && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-semibold tracking-wide text-center">Failed to send message. Please try again.</div>}
                    <button type="submit" disabled={isContactSubmitting || !contactMessage.trim()} className="w-full h-12 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] disabled:opacity-50 text-[var(--accent-contrast)] rounded-xl font-semibold text-[12px] tracking-[0.1em] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent)]/10">
                      {isContactSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Send Message</>}
                    </button>
                  </form>
                )}
                <div className="pt-2 border-t border-[var(--glass-border)] flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-wide">Support Email</span>
                    <span className="text-[9px] font-bold text-[var(--accent-secondary)]">{import.meta.env.VITE_CONTACT_EMAIL || 'support@cyberiaspace.app'}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    <span className="text-[8px] font-semibold tracking-wide text-[var(--text-muted)]">System Online</span>
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
    <div className="fixed inset-0 z-[10001] bg-[var(--bg-page)]/60 backdrop-blur-md flex items-center justify-center p-6 md:p-10 pointer-events-auto" onClick={onClose}>
      <div className="glass max-w-md w-full rounded-3xl border border-[var(--glass-border)] flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        
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
              <span className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">{s.label}</span>
              <div className="flex gap-1">
                {s.keys.map(k => (
                  <kbd key={k} className="bg-[var(--glass-bg)] border border-[var(--glass-border)] px-2 py-1 rounded-lg text-[9px] font-black text-[var(--accent-secondary)] min-w-[30px] text-center">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
          

        </div>

        <ModalFooter onClose={onClose} />
      </div>
    </div>
  )
);
