import React, { useEffect, useState } from 'react';
import { useModalStore } from '../store/useModalStore';

const Modal: React.FC = () => {
  const { isOpen, title, description, type, inputValue: initialValue, confirmText, onConfirm, closeModal } = useModalStore();
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
  const showCancel = type !== 'limit_space' && type !== 'limit_thought' && type !== 'alert';

  return (
    <div id="modal-overlay" className="fixed inset-0 bg-black/90 backdrop-blur-[10px] z-[10000] flex items-center justify-center animate-in fade-in duration-200 p-4">
      <div className="modal-box glass w-full max-w-[420px] p-6 md:p-10 rounded-[2rem] md:rounded-[40px] border border-white/10 text-center">
        <h2 className="text-lg md:text-xl font-bold mb-2 text-white">{title}</h2>
        {description && <p className="text-[10px] md:text-xs text-slate-400 mb-6 md:mb-8 uppercase tracking-widest leading-relaxed">{description}</p>}
        
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
      </div>
    </div>
  );
};

export default Modal;
