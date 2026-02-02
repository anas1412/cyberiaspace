import React, { useEffect, useState } from 'react';
import { create } from 'zustand';

interface ModalState {
  isOpen: boolean;
  title: string;
  description?: string;
  type: 'rename' | 'delete_space' | 'delete_thought' | 'limit_space' | 'limit_thought' | 'new_space' | 'alert';
  inputValue?: string;
  confirmText?: string;
  onConfirm?: (value?: string) => void;
  openModal: (params: Omit<ModalState, 'isOpen' | 'openModal' | 'closeModal'>) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  isOpen: false,
  title: '',
  type: 'alert',
  openModal: (params) => set({ ...params, isOpen: true }),
  closeModal: () => set({ isOpen: false }),
}));

const Modal: React.FC = () => {
  const { isOpen, title, description, type, inputValue: initialValue, confirmText, onConfirm, closeModal } = useModalStore();
  const [inputValue, setInputValue] = useState('');

  const handleConfirm = React.useCallback(() => {
    if (onConfirm) onConfirm(inputValue);
    closeModal();
  }, [onConfirm, inputValue, closeModal]);

  useEffect(() => {
    if (isOpen) setInputValue(initialValue || '');
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
    <div id="modal-overlay" className="fixed inset-0 bg-black/90 backdrop-blur-[10px] z-[10000] flex items-center justify-center animate-in fade-in duration-200">
      <div className="modal-box glass w-[420px] p-10 rounded-[40px] border border-white/10 text-center">
        <h2 className="text-xl font-bold mb-2 text-white">{title}</h2>
        {description && <p className="text-xs text-slate-400 mb-8 uppercase tracking-widest leading-relaxed">{description}</p>}
        
        {showInput && (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm outline-none mb-8 focus:border-indigo-500 text-white"
            placeholder={type === 'new_space' ? "Space Name" : ""}
            autoFocus
          />
        )}

        <div className="flex gap-4">
          {showCancel && (
            <button 
              onClick={closeModal}
              className="flex-1 py-4 text-xs font-bold uppercase tracking-widest bg-white/5 rounded-2xl text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          )}
          <button 
            onClick={handleConfirm}
            className="flex-1 py-4 text-xs font-bold uppercase tracking-widest bg-indigo-500 rounded-2xl text-white hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20"
          >
            {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
