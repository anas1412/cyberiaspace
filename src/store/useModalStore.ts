import { create } from 'zustand';

interface ModalState {
  isOpen: boolean;
  isPricingOpen: boolean;
  title: string;
  description?: string;
  type: 'rename' | 'delete_space' | 'delete_thought' | 'limit_space' | 'limit_thought' | 'new_space' | 'alert' | 'import_confirm' | 'reset_confirm' | 'confirm_cancel' | 'terms';
  inputValue?: string;
  confirmText?: string;
  onConfirm?: (value?: string) => void;
  openModal: (params: Omit<ModalState, 'isOpen' | 'isPricingOpen' | 'openModal' | 'closeModal' | 'openPricing' | 'closePricing'>) => void;
  closeModal: () => void;
  openPricing: () => void;
  closePricing: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  isOpen: false,
  isPricingOpen: false,
  title: '',
  type: 'alert',
  openModal: (params) => set({ 
    description: undefined, 
    inputValue: undefined, 
    confirmText: undefined,
    onConfirm: undefined,
    ...params, 
    isOpen: true 
  }),
  closeModal: () => set({ isOpen: false }),
  openPricing: () => set({ isPricingOpen: true }),
  closePricing: () => set({ isPricingOpen: false }),
}));
