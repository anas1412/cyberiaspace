import React, { useEffect, useState } from 'react';
import { useModalStore } from '../store/useModalStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Cloud, HardDrive, X } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Modal: React.FC = () => {
  const { isOpen, title, description, type, inputValue: initialValue, confirmText, onConfirm, content, cancelText, onCancel, closeModal } = useModalStore();
  const [inputValue, setInputValue] = useState('');

  const handleConfirm = React.useCallback((value?: string) => {
    if (onConfirm) onConfirm(value || inputValue);
    closeModal();
  }, [onConfirm, inputValue, closeModal]);

  const handleCancel = React.useCallback(() => {
    if (onCancel) onCancel();
    closeModal();
  }, [onCancel, closeModal]);

  useEffect(() => {
    if (isOpen) {
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
  const showCancel = !['limit_space', 'limit_thought', 'terms', 'conflict_resolver'].includes(type);
  const showStandardButtons = !['terms', 'conflict_resolver', 'custom'].includes(type);
  const showXButton = !['terms', 'custom'].includes(type);

  return (
    <div id="modal-overlay" className="fixed inset-0 bg-[var(--bg-page)]/90 backdrop-blur-[10px] z-[11000] flex items-center justify-center animate-in fade-in duration-200 p-4">
      <div className={cn(
        "modal-box glass w-full p-6 md:p-10 rounded-2xl border border-[var(--glass-border)] relative",
        type !== 'custom' && "text-center",
        type === 'terms' ? "max-w-[500px]" : "max-w-[420px]"
      )}>
        {showXButton && (
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--glass-bg)] hover:bg-[var(--bg-page)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors z-50"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {type !== 'custom' && <h2 className="text-lg md:text-xl font-bold mb-2 text-[var(--text-primary)]">{title}</h2>}

        {type === 'terms' ? (
          <div className="text-left space-y-8 my-8 max-h-[70vh] overflow-y-auto pr-4 custom-scroll">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { title: 'Local First', icon: '🔒', desc: 'Your data stays on your device by default.' },
                { title: 'Manual Pay', icon: '💳', desc: 'No auto-billing. You control renewals.' },
                { title: 'Pure Ownership', icon: '✨', desc: 'We never sell your data or your thoughts.' },
              ].map((card, i) => (
                <div key={i} className="bg-[var(--glass-bg)] border border-[var(--border)] p-4 rounded-2xl flex flex-col items-center text-center">
                  <span className="text-xl mb-2">{card.icon}</span>
                  <h4 className="text-[9px] font-semibold tracking-wide text-blue-400 mb-1">{card.title}</h4>
                  <p className="text-[10px] text-[var(--text-muted)] font-medium leading-tight">{card.desc}</p>
                </div>
              ))}
            </div>

            <div className="space-y-6">
              {[
                { title: 'A. Data Ownership & Governance', desc: 'Everything you create in Cyberia is your property. We treat your thoughts as private, kinetic assets.' },
                { title: 'B. Payments & Security', desc: 'We use Flouci for payment processing. Cyberia never touches your sensitive card details.' },
                { title: 'C. AI Interaction', desc: 'When communicating with The Oracle, relevant snippets of your space are processed by high-speed Llama models via Groq.' },
                { title: 'D. Cloud Sync Protocol', desc: 'Sync is a convenience service. Data sent to our cloud (Supabase) is encrypted in-transit and isolated to your account.' },
                { title: 'E. Ephemeral Sharing', desc: 'Publicly shared snapshots are temporary. They naturally expire and are purged from our servers 30 days after their last update.' },
                { title: 'F. Portability Commitment', desc: "Cyberia will always provide a free, unrestricted way to export your data into standard formats like Markdown or JSON." }
              ].map((protocol, i) => (
                <div key={i} className="space-y-1.5 border-l-2 border-blue-500/20 pl-4 py-1">
                  <h4 className="text-[10px] font-semibold tracking-wide text-blue-400/80">{protocol.title}</h4>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed font-medium">{protocol.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : type === 'conflict_resolver' ? (
          <div className="mt-8">
            <p className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-widest text-center mb-6">
              Choose which data to keep
            </p>
            <div className="flex flex-row gap-3">
              <button
                onClick={() => handleConfirm('local')}
                className="flex-1 flex flex-col items-center gap-3 py-5 px-3 bg-[var(--glass-bg)] hover:bg-[var(--bg-page)] border border-[var(--border)] rounded-2xl transition-all active:scale-95 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-[var(--glass-border)] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <HardDrive className="w-5 h-5 text-[var(--text-dimmed)]" />
                </div>
                <div className="text-center">
                  <span className="block text-[9px] font-semibold tracking-wide text-[var(--text-primary)] mb-1">Local Data</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-medium">Keep this device</span>
                </div>
              </button>
              <button
                onClick={() => handleConfirm('cloud')}
                className="flex-1 flex flex-col items-center gap-3 py-5 px-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-2xl transition-all active:scale-95 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Cloud className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="text-center">
                  <span className="block text-[9px] font-semibold tracking-wide text-indigo-300 mb-1">Cloud Backup</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-medium">Restore from cloud</span>
                </div>
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] font-medium text-center mt-4">
              Cloud sync will update with your choice
            </p>
          </div>
        ) : type === 'custom' ? (
          <div className="my-4">
            {content}
          </div>
        ) : (
          description && (
            <p className={cn(
              "text-[10px] md:text-xs text-[var(--text-muted)] mb-6 md:mb-8 leading-relaxed",
              !['limit_thought', 'limit_space'].includes(type) ? "uppercase tracking-widest" : "tracking-wide"
            )}>
              {description}
            </p>
          )
        )}

        {showInput && (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full bg-[var(--bg-page)]/40 border border-[var(--glass-border)] rounded-xl p-3 md:p-4 text-sm outline-none mb-6 md:mb-8 focus:border-[var(--accent)] text-[var(--text-primary)]"
            placeholder={type === 'new_space' ? "Space Name" : ""}
            autoFocus
          />
        )}

        {showStandardButtons && (
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <button
              onClick={() => handleConfirm()}
              className="order-1 md:order-2 flex-1 py-3.5 md:py-4 text-[10px] md:text-xs font-semibold tracking-wide bg-[var(--accent)] rounded-xl text-[var(--accent-contrast)] hover:opacity-90 transition-colors shadow-lg shadow-[var(--accent-glow)]"
            >
              {confirmText || 'Confirm'}
            </button>
            {showCancel && (
              <button
                onClick={handleCancel}
                className="order-2 md:order-1 flex-1 py-3.5 md:py-4 text-[10px] md:text-xs font-semibold tracking-wide bg-[var(--glass-bg)] rounded-xl text-[var(--text-primary)] hover:bg-[var(--bg-page)] transition-colors"
              >
                {cancelText || 'Cancel'}
              </button>
            )}
          </div>
        )}

        {type === 'terms' && (
          <button
            onClick={() => handleConfirm()}
            className="w-full py-4 text-[10px] font-semibold tracking-wide bg-blue-500 rounded-2xl text-white hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
          >
            Acknowledge & Enter
          </button>
        )}
      </div>
    </div>
  );
};

export default Modal;
