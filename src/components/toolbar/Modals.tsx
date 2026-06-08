import React, { useState } from 'react';
import { 
  CheckCircle, MessageSquare, Loader2, Send, MousePointer2,
  Database, HelpCircle, Laptop, Download, Upload, 
  X, Info, ExternalLink,
  FileText, Smartphone, Github
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { APP_VERSION, GITHUB_URL, DISCORD_INVITE_URL } from '../../constants';
import { useStore } from '../../store/useStore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
        { label: 'Terms', path: '/terms' },
        { label: 'Legal Notice', path: '/legal' },
        { label: 'Contact', path: null, href: 'mailto:support@cyberiaspace.app' }
      ].map((link, idx) => (
        link.path ? (
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
        ) : (
          <a
            key={idx}
            href={link.href}
            className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            {link.label}
          </a>
        )
      ))}
      <span className="text-[10px] text-[var(--text-muted)] font-medium">v{APP_VERSION}</span>
    </div>
  </div>
);

// --- Settings Modal ---

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  handleExport: () => void;
  handleImport: (e: any) => void;
  deferredPrompt: any;
  handleInstall: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen, onClose,
  handleExport, handleImport,
  deferredPrompt, handleInstall
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'storage'>('general');
  const totalThoughtCount = useStore((state) => state.totalThoughtCount);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10001] bg-[var(--bg-page)]/60 backdrop-blur-md flex items-center justify-center p-6 md:p-10 pointer-events-auto" onClick={onClose}>
      <div className="glass max-w-2xl w-full rounded-3xl border border-[var(--glass-border)] flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
        
        <ModalHeader title="System Settings" onClose={onClose} />

        {/* Tab Bar */}
        <div className="px-8 pt-6 pb-2 flex gap-2 shrink-0 overflow-x-auto no-scrollbar">
          {[
            { id: 'general', label: 'General', icon: Info },
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
                    <MessageSquare className="w-3.5 h-3.5" /> Community
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <a
                      href={GITHUB_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:bg-[var(--bg-page)] hover:border-[var(--glass-border)] transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Github className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                        <span className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)] group-hover:text-[var(--text-primary)]">GitHub</span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--text-dimmed)]" />
                    </a>
                    <a
                      href={DISCORD_INVITE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:bg-[var(--bg-page)] hover:border-[var(--glass-border)] transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <MessageSquare className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                        <span className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)] group-hover:text-[var(--text-primary)]">Discord</span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--text-dimmed)]" />
                    </a>
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

            {activeTab === 'storage' && (
              <motion.div 
                key="storage"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                {/* Local Storage Info */}
                <section>
                  <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] mb-4 flex items-center gap-2">
                    <Database className="w-3.5 h-3.5" /> Local Storage
                  </p>
                  <div className="p-6 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-xl bg-[var(--bg-page)] border border-[var(--glass-border)]">
                        <p className="text-[11px] font-black text-[var(--text-primary)]">{totalThoughtCount}</p>
                        <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wide mt-0.5">Total Thoughts</p>
                      </div>
                      <div className="p-3 rounded-xl bg-[var(--bg-page)] border border-[var(--glass-border)]">
                        <p className="text-[11px] font-black text-[var(--text-primary)]">Local</p>
                        <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wide mt-0.5">Storage Type</p>
                      </div>
                    </div>
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
  contactName, setContactName, contactEmail, setContactEmail, contactMessage, setContactMessage, isContactSubmitting, contactSubmitStatus, handleContactSubmit
}) => (
  isOpen && (
    <div className="fixed inset-0 z-[10001] bg-[var(--bg-page)]/60 backdrop-blur-md flex items-center justify-center p-6 md:p-10 pointer-events-auto" onClick={onClose}>
      <div className="glass max-w-xl w-full rounded-3xl border border-[var(--glass-border)] flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        
        <ModalHeader title="System Help" onClose={onClose} />

        {/* Tabs */}
        <div className="px-8 pt-6 pb-2 flex gap-2 shrink-0 overflow-x-auto no-scrollbar">
          {[{ id: 'about', label: 'About Us' }, { id: 'contact', label: 'Contact Us' }].map((tab) => (
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
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">A spatial workspace for non-linear thinking. Open source, local, runs entirely in your browser.</p>

                <div className="pt-3 border-t border-[var(--glass-border)] space-y-2">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Community & Resources</p>
                  <div className="space-y-1.5">
                    <a
                      href={GITHUB_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--text-primary)]/5 text-[12px] font-semibold tracking-wide text-[var(--text-primary)] transition-colors group"
                    >
                      <Github className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:scale-110 transition-transform" />
                      GitHub
                      <ExternalLink className="w-2.5 h-2.5 ml-auto text-[var(--text-muted)]" />
                    </a>
                    <a
                      href={DISCORD_INVITE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--text-primary)]/5 text-[12px] font-semibold tracking-wide text-[var(--text-primary)] transition-colors group"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:scale-110 transition-transform" />
                      Discord
                      <ExternalLink className="w-2.5 h-2.5 ml-auto text-[var(--text-muted)]" />
                    </a>
                    <a
                      href={`${GITHUB_URL}#readme`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--text-primary)]/5 text-[12px] font-semibold tracking-wide text-[var(--text-primary)] transition-colors group"
                    >
                      <FileText className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:scale-110 transition-transform" />
                      Documentation
                      <ExternalLink className="w-2.5 h-2.5 ml-auto text-[var(--text-muted)]" />
                    </a>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/10 text-center">
                  <p className="text-[10px] font-medium text-[var(--text-muted)]">Open Source &middot; MIT License</p>
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
