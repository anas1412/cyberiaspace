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
          <div className="text-left space-y-6 my-8 max-h-[60vh] overflow-y-auto pr-4 custom-scroll">
            {[
              { title: '1. Data Ownership', desc: 'Everything you create is yours. It stays on your device by default and only goes to the cloud if you sign in.' },
              { title: '2. Manual Renewal', desc: 'We do not support automatic billing. You choose when to extend your Pro access. No unexpected charges, ever.' },
              { title: '3. Acceptable Use', desc: "Don't store illegal content or use the AI to cause harm. You are responsible for what happens in your spaces." },
              { title: '4. Service Uptime', desc: 'We try to stay online 24/7, but technology can be tricky. We suggest using the Export button to keep regular backups.' },
              { title: '5. No Lock-in', desc: 'We never hold your data hostage. You can always export your entire workspace for free, forever.' },
              { title: '6. Fair AI Use', desc: 'Pro users get a generous amount of AI access for creative work. To keep the system fast for everyone, we use a fair-use policy to prevent automated abuse.' },
              { title: '7. Feature Evolution', desc: 'Cyberia is always growing. We might add, change, or remove features as we work to build the best experience.' },
              { title: '8. Security', desc: 'Your cloud data is only as safe as your Google account. Keep your login secure to protect your neural link.' }
            ].map((rule, i) => (
              <div key={i} className="space-y-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{rule.title}</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">{rule.desc}</p>
              </div>
            ))}
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
