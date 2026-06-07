import { create } from 'zustand';

export type DeletionMode = 'all' | 'local' | 'cloud';

export interface DeletionCounts {
  spaces: number;
  thoughts: number;
  stacks: number;
  files: number;
}

export interface ModalState {
  isOpen: boolean;
  isPricingOpen: boolean;
  title: string;
  description?: string;
  type: 'rename' | 'delete_space' | 'delete_thought' | 'delete_stack' | 'limit_space' | 'limit_thought' | 'new_space' | 'alert' | 'import_confirm' | 'reset_confirm' | 'confirm_cancel' | 'terms' | 'custom' | 'conflict_resolver' | 'quota_resolver' | 'delete_data';
  guestSpaces?: number;
  cloudSpaces?: number;
  inputValue?: string;
  confirmText?: string;
  cancelText?: string;
  onCancel?: () => void;
  onConfirm?: (value?: string | DeletionMode) => void;
  content?: React.ReactNode;
  deletionCounts?: DeletionCounts;
  defaultDeletionMode?: DeletionMode;
  stackName?: string;
  thoughtCount?: number;
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
    cancelText: undefined,
    onCancel: undefined,
    description: undefined,
    inputValue: undefined,
    confirmText: undefined,
    onConfirm: undefined,
    content: undefined,
    stackName: undefined,
    thoughtCount: undefined,
    ...params,
    isOpen: true
  }),
  closeModal: () => set({ 
    isOpen: false,
    // Clear callbacks to prevent stale callback execution after close
    onCancel: undefined,
    onConfirm: undefined
  }),
  openPricing: () => set({ isPricingOpen: true }),
  closePricing: () => set({ isPricingOpen: false }),
}));
