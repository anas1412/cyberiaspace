import React, { useEffect, useState } from 'react';
import { useModalStore, type DeletionMode, type DeletionCounts } from '../store/useModalStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Cloud, HardDrive, X, Trash2, Unlink } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Modal: React.FC = () => {
  const { isOpen, title, description, type, inputValue: initialValue, confirmText, onConfirm, content, cancelText, onCancel, closeModal, deletionCounts, defaultDeletionMode, stackName, thoughtCount } = useModalStore();
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
  const showCancel = !['limit_space', 'limit_thought', 'terms', 'conflict_resolver', 'delete_data'].includes(type);
  const showStandardButtons = !['terms', 'conflict_resolver', 'custom', 'delete_data', 'delete_stack'].includes(type);
  const showXButton = !['terms', 'custom', 'delete_data'].includes(type);

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
                { title: 'B. AI Interaction', desc: 'When communicating with Cyberia AI, relevant snippets of your space are processed by high-speed Llama models via Groq.' },
                { title: 'C. Cloud Sync Protocol', desc: 'Sync is a convenience service. Data sent to our cloud (Supabase) is encrypted in-transit and isolated to your account.' },
                { title: 'D. Ephemeral Sharing', desc: 'Publicly shared snapshots are temporary. They naturally expire and are purged from our servers 30 days after their last update.' },
                { title: 'E. Portability Commitment', desc: "Cyberia will always provide a free, unrestricted way to export your data into standard formats like Markdown or JSON." }
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
        ) : type === 'delete_stack' ? (
          <DeleteStackModal
            stackName={stackName || 'this group'}
            thoughtCount={thoughtCount ?? 0}
            onConfirm={(choice) => handleConfirm(choice)}
            onCancel={handleCancel}
          />
        ) : type === 'delete_data' ? (
          <DeleteDataModal 
            deletionCounts={deletionCounts}
            defaultMode={defaultDeletionMode || 'all'}
            onConfirm={onConfirm}
            onCancel={handleCancel}
            confirmText={confirmText}
            cancelText={cancelText}
          />
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

interface DeleteDataModalProps {
  deletionCounts?: DeletionCounts;
  defaultMode?: DeletionMode;
  onConfirm?: (value?: DeletionMode) => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

const DeleteDataModal: React.FC<DeleteDataModalProps> = ({
  deletionCounts,
  defaultMode = 'all',
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
}) => {
  const [selectedMode, setSelectedMode] = useState<DeletionMode>(defaultMode);

  const handleContinue = () => {
    onConfirm?.(selectedMode);
  };

  const deletionModes: Array<{
    mode: DeletionMode;
    icon: React.ReactNode;
    title: string;
    description: string;
    color: string;
    bgColor: string;
    borderColor: string;
    selectedBorderColor: string;
    iconBg: string;
  }> = [
    {
      mode: 'all',
      icon: <Trash2 className="w-5 h-5" />,
      title: 'Everything (Local + Cloud)',
      description: 'Complete reset everywhere',
      color: 'red',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-[var(--glass-border)]',
      selectedBorderColor: 'border-red-500/30',
      iconBg: 'bg-red-500/20',
    },
    {
      mode: 'local',
      icon: <HardDrive className="w-5 h-5" />,
      title: 'Local Data Only',
      description: 'Clear this device only',
      color: 'accent',
      bgColor: 'bg-[var(--accent)]/10',
      borderColor: 'border-[var(--glass-border)]',
      selectedBorderColor: 'border-[var(--accent)]/30',
      iconBg: 'bg-[var(--accent)]/20',
    },
    {
      mode: 'cloud',
      icon: <Cloud className="w-5 h-5" />,
      title: 'Cloud Backup Only',
      description: 'Clear cloud, keep this device',
      color: 'blue',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-[var(--glass-border)]',
      selectedBorderColor: 'border-blue-500/30',
      iconBg: 'bg-blue-500/20',
    },
  ];

  const getTextColor = (mode: DeletionMode, selected: boolean) => {
    if (!selected) return 'text-[var(--text-primary)]';
    if (mode === 'all') return 'text-red-300';
    if (mode === 'cloud') return 'text-blue-300';
    return 'text-[var(--accent)]';
  };

  const getIconColor = (mode: DeletionMode, selected: boolean) => {
    if (!selected) return 'text-[var(--text-dimmed)]';
    if (mode === 'all') return 'text-red-400';
    if (mode === 'cloud') return 'text-blue-400';
    return 'text-[var(--accent)]';
  };

  return (
    <div className="mt-6">
      <p className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-widest text-center mb-6">
        What would you like to delete?
      </p>

      <div className="space-y-3">
        {deletionModes.map(({ mode, icon, title, description, bgColor, borderColor, selectedBorderColor, iconBg }) => {
          const isSelected = selectedMode === mode;
          return (
            <button
              key={mode}
              onClick={() => setSelectedMode(mode)}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all",
                isSelected ? bgColor : "bg-[var(--glass-bg)]",
                isSelected ? selectedBorderColor : borderColor,
                !isSelected && "hover:bg-[var(--bg-page)]"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                isSelected ? iconBg : "bg-[var(--glass-border)]"
              )}>
                <span className={getIconColor(mode, isSelected)}>{icon}</span>
              </div>
              <div className="flex-1 text-left">
                <span className={cn(
                  "block text-[10px] font-semibold tracking-wide",
                  getTextColor(mode, isSelected)
                )}>
                  {title}
                </span>
                <span className="text-[9px] text-[var(--text-muted)]">{description}</span>
              </div>
              {isSelected && (
                <div className="w-4 h-4 rounded-full shrink-0 bg-red-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Count Summary */}
      {deletionCounts && (
        <div className="mt-6 p-4 rounded-xl bg-[var(--bg-page)] border border-[var(--glass-border)]">
          <p className="text-[9px] text-red-400 font-semibold tracking-wide mb-2">
            Will delete:
          </p>
          <ul className="space-y-1">
            {deletionCounts.spaces > 0 && (
              <li className="text-[10px] text-[var(--text-muted)]">
                • {deletionCounts.spaces} {deletionCounts.spaces === 1 ? 'space' : 'spaces'}
              </li>
            )}
            {deletionCounts.thoughts > 0 && (
              <li className="text-[10px] text-[var(--text-muted)]">
                • {deletionCounts.thoughts} {deletionCounts.thoughts === 1 ? 'thought' : 'thoughts'}
              </li>
            )}
            {deletionCounts.stacks > 0 && (
              <li className="text-[10px] text-[var(--text-muted)]">
                • {deletionCounts.stacks} {deletionCounts.stacks === 1 ? 'stack' : 'stacks'}
              </li>
            )}
            {deletionCounts.files > 0 && (
              <li className="text-[10px] text-[var(--text-muted)]">
                • {deletionCounts.files} {deletionCounts.files === 1 ? 'file' : 'files'}
              </li>
            )}
            {deletionCounts.spaces === 0 && deletionCounts.thoughts === 0 && 
             deletionCounts.stacks === 0 && deletionCounts.files === 0 && (
              <li className="text-[10px] text-[var(--text-muted)]">• Nothing to delete</li>
            )}
          </ul>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={onCancel}
          className="flex-1 py-3.5 text-[10px] font-semibold tracking-wide bg-[var(--glass-bg)] rounded-xl text-[var(--text-primary)] hover:bg-[var(--bg-page)] transition-colors"
        >
          {cancelText || 'Cancel'}
        </button>
        <button
          onClick={handleContinue}
          className="flex-1 py-3.5 text-[10px] font-semibold tracking-wide bg-red-500 rounded-xl text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
        >
          {confirmText || 'Continue'} →
        </button>
      </div>
    </div>
  );
};

interface DeleteStackModalProps {
  stackName: string;
  thoughtCount: number;
  onConfirm: (choice: string) => void;
  onCancel: () => void;
}

const DeleteStackModal: React.FC<DeleteStackModalProps> = ({
  stackName,
  thoughtCount,
  onConfirm,
  onCancel,
}) => {
  const options = [
    {
      value: 'unlink',
      icon: <Unlink className="w-5 h-5" />,
      title: 'Remove collection only',
      description: 'Keeps all thoughts — they stay in your space.',
      color: 'accent',
      bgColor: 'bg-[var(--accent)]/10',
      borderColor: 'border-[var(--glass-border)]',
      selectedBorderColor: 'border-[var(--accent)]/30',
      iconBg: 'bg-[var(--accent)]/20',
      iconColor: 'text-[var(--accent)]',
    },
    {
      value: 'delete_all',
      icon: <Trash2 className="w-5 h-5" />,
      title: 'Remove collection + all inside',
      description: thoughtCount > 0
        ? `Also removes ${thoughtCount} thought${thoughtCount === 1 ? '' : 's'} inside it.`
        : 'No thoughts inside — nothing extra to remove.',
      color: 'red',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-[var(--glass-border)]',
      selectedBorderColor: 'border-red-500/30',
      iconBg: 'bg-red-500/20',
      iconColor: 'text-red-400',
    },
  ];

  const [selected, setSelected] = useState(options[0].value);

  return (
    <div className="mt-6">
      <p className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-widest text-center mb-6">
        What do you want to do with "{stackName}"?
      </p>

      <div className="space-y-3">
        {options.map(({ value, icon, title, description, bgColor, borderColor, selectedBorderColor, iconBg, iconColor }) => {
          const isSelected = selected === value;
          return (
            <button
              key={value}
              onClick={() => setSelected(value)}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left",
                isSelected ? bgColor : "bg-[var(--glass-bg)]",
                isSelected ? selectedBorderColor : borderColor,
                !isSelected && "hover:bg-[var(--bg-page)]"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                isSelected ? iconBg : "bg-[var(--glass-border)]"
              )}>
                <span className={isSelected ? iconColor : 'text-[var(--text-dimmed)]'}>{icon}</span>
              </div>
              <div className="flex-1">
                <span className={cn(
                  "block text-[10px] font-semibold tracking-wide",
                  isSelected && value === 'delete_all' ? 'text-red-300' : '',
                  isSelected && value === 'unlink' ? 'text-[var(--accent)]' : '',
                  !isSelected ? 'text-[var(--text-primary)]' : ''
                )}>
                  {title}
                </span>
                <span className="text-[9px] text-[var(--text-muted)]">{description}</span>
              </div>
              {isSelected && (
                <div className={cn(
                  "w-4 h-4 rounded-full shrink-0",
                  value === 'delete_all' ? 'bg-red-500' : 'bg-[var(--accent)]'
                )} />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onCancel}
          className="flex-1 py-3.5 text-[10px] font-semibold tracking-wide bg-[var(--glass-bg)] rounded-xl text-[var(--text-primary)] hover:bg-[var(--bg-page)] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(selected)}
          className={cn(
            "flex-1 py-3.5 text-[10px] font-semibold tracking-wide rounded-xl text-white transition-colors shadow-lg",
            selected === 'delete_all'
              ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
              : 'bg-[var(--accent)] hover:opacity-90 shadow-[var(--accent-glow)]'
          )}
        >
          {selected === 'delete_all' ? 'Remove everything' : 'Remove collection'}
        </button>
      </div>
    </div>
  );
};

export default Modal;
