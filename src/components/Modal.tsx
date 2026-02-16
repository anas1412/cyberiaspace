import React, { useEffect, useState } from 'react';
import { useModalStore } from '../store/useModalStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Modal: React.FC = () => {
  const { isOpen, title, description, type, inputValue: initialValue, confirmText, onConfirm, content, closeModal } = useModalStore();
  const [inputValue, setInputValue] = useState('');

  const handleConfirm = React.useCallback(() => {
    if (onConfirm) onConfirm(inputValue);
    closeModal();
  }, [onConfirm, inputValue, closeModal]);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInputValue(initialValue || '');
    }
  }, [isOpen, initialValue]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Enter') {
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleConfirm]);

  if (!isOpen) return null;

  const showInput = ['rename', 'new_space'].includes(type);
  const showCancel = !['limit_space', 'limit_thought', 'alert', 'terms'].includes(type);

  return (
    <div id="modal-overlay" className="fixed inset-0 bg-black/90 backdrop-blur-[10px] z-[11000] flex items-center justify-center animate-in fade-in duration-200 p-4">
      <div className={cn(
        "modal-box glass w-full p-6 md:p-10 rounded-[2rem] md:rounded-[40px] border border-white/10",
        type !== 'custom' && "text-center",
        type === 'terms' ? "max-w-[500px]" : "max-w-[420px]"
      )}>
        {type !== 'custom' && <h2 className="text-lg md:text-xl font-bold mb-2 text-white">{title}</h2>}

        {type === 'terms' ? (
          <div className="text-left space-y-8 my-8 max-h-[70vh] overflow-y-auto pr-4 custom-scroll">
            {/* 1. Visual Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { title: 'Local First', icon: '🔒', desc: 'Your data stays on your device by default.' },
                { title: 'Manual Pay', icon: '💳', desc: 'No auto-billing. You control renewals.' },
                { title: 'Pure Ownership', icon: '✨', desc: 'We never sell your data or your thoughts.' },
              ].map((card, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl flex flex-col items-center text-center">
                  <span className="text-xl mb-2">{card.icon}</span>
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1">{card.title}</h4>
                  <p className="text-[10px] text-slate-500 font-medium leading-tight">{card.desc}</p>
                </div>
              ))}
            </div>

            {/* 2. Detailed Protocol */}
            <div className="space-y-6">
              {[
                {
                  title: 'A. Data Ownership & Governance',
                  desc: 'Everything you create in Cyberia is your property. We treat your thoughts as private, kinetic assets. We do not license, mine, or metadata-track your workspace content.'
                },
                {
                  title: 'B. Payments & Security (Konnect Network)',
                  desc: 'We use the Konnect Network for payment processing. Cyberia never touches your sensitive card details. Our system only receives a verification token to activate your Pro tier.'
                },
                {
                  title: 'C. AI Interaction (Llama Models)',
                  desc: 'When communicating with The Oracle, relevant snippets of your space are processed by high-speed Llama models via Groq. This data is used only for real-time inference and is not stored permanently or used for global model training.'
                },
                {
                  title: 'D. Cloud Sync Protocol',
                  desc: 'Sync is a convenience service. Data sent to our cloud (Vercel KV) is encrypted in-transit and isolated to your Google ID. You can wipe your cloud data at any time.'
                },
                {
                  title: 'E. Ephemeral Sharing (30-Day Policy)',
                  desc: 'Publicly shared snapshots are temporary. They naturally expire and are purged from our servers 30 days after their last update to maintain a clean digital footprint.'
                },
                {
                  title: 'F. Portability Commitment',
                  desc: "Cyberia will always provide a free, unrestricted way to export your data into standard formats like Markdown or JSON. You are never locked into our ecosystem."
                }
              ].map((protocol, i) => (
                <div key={i} className="space-y-1.5 border-l-2 border-indigo-500/20 pl-4 py-1">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400/80">{protocol.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-medium">{protocol.desc}</p>
                </div>
              ))}
            </div>

            {/* 3. Footer Tech Specs */}
            <div className="pt-4 border-t border-white/5">
              <p className="text-[9px] font-mono text-slate-600 uppercase tracking-tighter">
                Architecture: AES-256-GCM • TLS 1.3 • OAuth 2.0 • Local-First PWA
              </p>
            </div>
          </div>
        ) : type === 'custom' ? (
          <div className="my-4">
            {content}
          </div>
        ) : (
          description && <p className="text-[10px] md:text-xs text-slate-400 mb-6 md:mb-8 uppercase tracking-widest leading-relaxed">{description}</p>
        )}

        {showInput && (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 md:p-4 text-sm outline-none mb-6 md:mb-8 focus:border-[var(--accent)] text-white"
            placeholder={type === 'new_space' ? "Space Name" : ""}
            autoFocus
          />
        )}

        {type !== 'custom' && (
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <button
              onClick={handleConfirm}
              className="order-1 md:order-2 flex-1 py-3.5 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-widest bg-[var(--accent)] rounded-xl md:rounded-2xl text-white hover:opacity-90 transition-colors shadow-lg shadow-[var(--accent-glow)]"
            >
              {confirmText || 'Confirm'}
            </button>
            {showCancel && (
              <button
                onClick={closeModal}
                className="order-2 md:order-1 flex-1 py-3.5 md:py-4 text-[10px] md:text-xs font-bold uppercase tracking-widest bg-white/5 rounded-xl md:rounded-2xl text-white hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
