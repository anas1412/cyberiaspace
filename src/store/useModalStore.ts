import { create } from 'zustand';

interface ModalState {
  isOpen: boolean;
  title: string;
  description?: string;
  type: 'rename' | 'delete_space' | 'delete_thought' | 'limit_space' | 'limit_thought' | 'new_space' | 'alert' | 'import_confirm';
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
  openModal: (params) => set({ 
    description: undefined, 
    inputValue: undefined, 
    confirmText: undefined,
    onConfirm: undefined,
    ...params, 
    isOpen: true 
  }),
  closeModal: () => set({ isOpen: false }),
}));
