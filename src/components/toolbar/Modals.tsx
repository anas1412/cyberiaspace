import React from 'react';
import { Plus, CheckCircle, MessageSquare, CircleHelp, Loader2, Send, MousePointer2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { APP_VERSION } from '../../constants';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
    <div className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-md flex items-center justify-center p-10 pointer-events-auto" onClick={onClose}>
      <div className="glass max-w-xl w-full p-10 rounded-[3rem] border border-white/10" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--accent-secondary)]">System Help</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><Plus className="w-6 h-6 rotate-45" /></button>
        </div>
        <div className="flex gap-2 mb-8 bg-white/5 p-2 rounded-2xl border border-white/5">
          {[{ id: 'about', label: 'About Us' }, { id: 'issue', label: 'Found an Issue?' }, { id: 'contact', label: 'Contact Us' }].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("flex-1 py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all", activeTab === tab.id ? "bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent-glow)]" : "text-slate-500 hover:text-white hover:bg-white/5")}>{tab.label}</button>
          ))}
        </div>
        <div className="min-h-[200px] animate-in fade-in slide-in-from-bottom-2 duration-300">
          {activeTab === 'about' && (
            <div className="space-y-5">
              <h4 className="text-[11px] font-black text-white uppercase tracking-widest">About Cyberia</h4>
              <p className="text-xs text-slate-400 leading-relaxed italic">Cyberia is a spatial workspace designed for fluid information management. We treat data as physical objects to help you visualize connections and organize your thoughts naturally.</p>
              <p className="text-xs text-slate-500 leading-relaxed">Designed for non-linear thinkers, visionaries, and digital architects. We believe productivity shouldn't feel like a spreadsheet. It should feel like a world.</p>
            </div>
          )}
          {activeTab === 'issue' && (
            <div className="space-y-5">
              <h4 className="text-[11px] font-black text-white uppercase tracking-widest">Report an Issue</h4>
              {quickSubmitStatus === 'success' ? (
                <div className="py-6 text-center space-y-3 bg-green-500/5 border border-green-500/10 rounded-2xl animate-in zoom-in-95 duration-300"><CheckCircle className="w-8 h-8 text-green-400 mx-auto" /><p className="text-[10px] font-black uppercase tracking-widest text-green-400">Report Transmitted</p></div>
              ) : (
                <form onSubmit={handleQuickSubmit} className="space-y-3">
                  <div className="flex gap-1.5 p-1 bg-black/40 border border-white/5 rounded-xl">{(['issue', 'feedback', 'feature'] as const).map((t) => (<button key={t} type="button" onClick={() => setQuickType(t)} className={cn("flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all", quickType === t ? "bg-white/10 text-white shadow-md border border-white/10" : "text-slate-600 hover:text-slate-400")}>{t}</button>))}</div>
                  <textarea required value={quickMessage} onChange={(e) => setQuickMessage(e.target.value)} placeholder="Quick report... (System logs will be attached)" className="w-full h-24 bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-white outline-none focus:border-[var(--accent)]/50 transition-all resize-none" />
                  <button type="submit" disabled={isQuickSubmitting || !quickMessage.trim()} className="w-full h-10 bg-[var(--accent)] hover:bg-[var(--accent)]/90 disabled:opacity-50 text-white rounded-xl font-black uppercase text-[9px] tracking-widest transition-all flex items-center justify-center gap-2">{isQuickSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3 h-3" /> Send Quick Report</>}</button>
                </form>
              )}
              <div className="relative flex items-center py-2"><div className="flex-grow border-t border-white/5"></div><span className="flex-shrink mx-4 text-[8px] font-black uppercase tracking-widest text-slate-700">OR</span><div className="flex-grow border-t border-white/5"></div></div>
              <div className="pt-1"><button onClick={() => window.open('/feedback', '_blank')} className="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/10 transition-all flex items-center justify-center gap-2 group"><MessageSquare className="w-3.5 h-3.5" /> Open Feedback Portal</button></div>
            </div>
          )}
          {activeTab === 'contact' && (
            <div className="space-y-5">
              <h4 className="text-[11px] font-black text-white uppercase tracking-widest">Contact Support</h4>
              {contactSubmitStatus === 'success' ? (
                <div className="py-10 text-center space-y-4 bg-green-500/5 border border-green-500/10 rounded-2xl animate-in zoom-in-95 duration-300"><CheckCircle className="w-10 h-10 text-green-400 mx-auto" /><div><p className="text-[10px] font-black uppercase tracking-widest text-green-400">Message Sent</p><p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">We will get back to you shortly.</p></div></div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><label className="text-[8px] font-black uppercase tracking-widest text-slate-600 ml-1">Name</label><input type="text" placeholder="Your Name" value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full h-10 bg-black/40 border border-white/5 rounded-xl px-4 text-xs text-white outline-none focus:border-[var(--accent)]/50 transition-all" /></div>
                    <div className="space-y-1.5"><label className="text-[8px] font-black uppercase tracking-widest text-slate-600 ml-1">Email</label><input type="email" required placeholder="your@email.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full h-10 bg-black/40 border border-white/5 rounded-xl px-4 text-xs text-white outline-none focus:border-[var(--accent)]/50 transition-all" /></div>
                  </div>
                  <div className="space-y-1.5"><label className="text-[8px] font-black uppercase tracking-widest text-slate-600 ml-1">Message</label><textarea required value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} placeholder="How can we help?" className="w-full h-24 bg-black/40 border border-white/5 rounded-xl p-4 text-xs text-white outline-none focus:border-[var(--accent)]/50 transition-all resize-none" /></div>
                  {contactSubmitStatus === 'error' && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-black uppercase tracking-widest text-center">Failed to send message. Please try again.</div>}
                  <button type="submit" disabled={isContactSubmitting || !contactMessage.trim()} className="w-full h-12 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black uppercase text-[10px] tracking-[0.1em] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10">{isContactSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Send Message</>}</button>
                </form>
              )}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between"><div className="flex flex-col"><span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Support Email</span><span className="text-[9px] font-bold text-[var(--accent-secondary)]">{import.meta.env.VITE_CONTACT_EMAIL || 'anasbassoumi@gmail.com'}</span></div><div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5"><div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" /><span className="text-[8px] font-black uppercase tracking-widest text-slate-400">System Online</span></div></div>
            </div>
          )}
        </div>
        <div className="mt-10 pt-8 border-t border-white/5 flex flex-col items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <CircleHelp className="w-5 h-5" />
            </div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 leading-relaxed">
              Version {APP_VERSION} <br /> Stable release.
            </p>
          </div>
          <div className="flex items-center gap-3 opacity-40 flex-wrap justify-center">
            <button 
              onClick={() => {
                window.history.pushState({}, '', '/privacy');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              Privacy Policy
            </button>
            <span className="w-0.5 h-0.5 rounded-full bg-white/20" />
            <button 
              onClick={() => {
                window.history.pushState({}, '', '/terms');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              Terms of Service
            </button>
            <span className="w-0.5 h-0.5 rounded-full bg-white/20" />
            <button 
              onClick={() => {
                window.history.pushState({}, '', '/sales-conditions');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              Terms of Sale & Refund Policy
            </button>
            <span className="w-0.5 h-0.5 rounded-full bg-white/20" />
            <button 
              onClick={() => {
                window.history.pushState({}, '', '/legal-notice');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              Legal Notice
            </button>
            <span className="w-0.5 h-0.5 rounded-full bg-white/20" />
            <button 
              onClick={() => {
                window.history.pushState({}, '', '/contact');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              Contact
            </button>
          </div>
        </div>
      </div>
    </div>
  )
);

export const ShortcutsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => (
  isOpen && (
    <div className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-md flex items-center justify-center p-10 pointer-events-auto" onClick={onClose}>
      <div className="glass max-w-md w-full p-10 rounded-[3rem] border border-white/10" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-8"><h3 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--accent-secondary)]">Command Center</h3><button onClick={onClose} className="text-slate-500 hover:text-white"><Plus className="w-6 h-6 rotate-45" /></button></div>
        <div className="space-y-6">
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
            <div key={i} className="flex justify-between items-center group"><span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">{s.label}</span><div className="flex gap-1">{s.keys.map(k => (<kbd key={k} className="bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-[9px] font-black text-[var(--accent-secondary)] min-w-[30px] text-center">{k}</kbd>))}</div></div>
          ))}
        </div>
        <div className="mt-10 pt-8 border-t border-white/5 flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent-secondary)]"><MousePointer2 className="w-5 h-5" /></div><p className="text-[9px] uppercase font-bold tracking-widest text-slate-500 leading-relaxed">Middle-click or Alt+Drag to move around the infinite workspace.</p></div>
      </div>
    </div>
  )
);
