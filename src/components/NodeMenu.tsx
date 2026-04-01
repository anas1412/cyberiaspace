import React, { useState, useRef, useEffect } from 'react';
import { getThoughtConfig } from './thought/registry';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import type { Thought } from '../db';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  X, Trash2, ArrowUp, ArrowDown, Maximize2, FolderPlus, Folder,
  ChevronRight, Tag, Type, ListTodo, Palette, Table, Image, Youtube, File,
  Star, CheckCircle, Circle, Clock, Unlink
} from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const typeIcons = {
  label: Tag,
  text: Type,
  tasks: ListTodo,
  paint: Palette,
  table: Table,
  image: Image,
  embed: Youtube,
  file: File,
};

const statusOptions = [
  { value: 'none', label: 'None', color: 'bg-slate-500', icon: Circle, iconColor: 'text-[var(--text-muted)]' },
  { value: 'todo', label: 'Todo', color: 'bg-[var(--status-todo)]', icon: Circle, iconColor: 'text-[var(--status-todo)]' },
  { value: 'doing', label: 'Doing', color: 'bg-[var(--status-doing)]', icon: Clock, iconColor: 'text-[var(--status-doing)]' },
  { value: 'done', label: 'Done', color: 'bg-[var(--status-done)]', icon: CheckCircle, iconColor: 'text-[var(--status-done)]' },
] as const;

const priorityOptions = [
  { value: 'none', label: 'None', color: 'bg-slate-500' },
  { value: 'low', label: 'Low', color: 'bg-[var(--prio-low)]' },
  { value: 'medium', label: 'Medium', color: 'bg-[var(--prio-medium)]' },
  { value: 'high', label: 'High', color: 'bg-[var(--prio-high)]' },
  { value: 'urgent', label: 'Urgent', color: 'bg-[var(--prio-urgent)]' },
] as const;

interface NodeMenuProps {
  thought: Thought;
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

type Submenu = 'status' | 'priority' | 'type' | 'stack' | null;

const NodeMenu: React.FC<NodeMenuProps> = ({ thought, isOpen, onClose, triggerRef }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [submenu, setSubmenu] = useState<Submenu>(null);
  
  const updateThought = useStore((state) => state.updateThought);
  const deleteThought = useStore((state) => state.deleteThought);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const bringToFront = useStore((state) => state.bringToFront);
  const sendToBack = useStore((state) => state.sendToBack);
  const createStack = useStore((state) => state.createStack);
  const stacks = useStore((state) => state.stacks);
  const isReadOnly = useStore((state) => state.isReadOnly);
  const { openModal } = useModalStore();

  const handleDelete = () => {
    openModal({
      title: 'Delete Thought?',
      description: 'This action cannot be undone.',
      type: 'delete_thought',
      confirmText: 'Delete',
      onConfirm: () => deleteThought(thought.id)
    });
    onClose();
  };

  const handleTypeChange = (type: Thought['type']) => {
    const config = getThoughtConfig(type);
    const payload = config?.createPayload();
    updateThought(thought.id, { type, data: payload });
    setSubmenu(null);
  };

  const handleStatusChange = (status: Thought['status']) => {
    updateThought(thought.id, { status });
    setSubmenu(null);
  };

  const handlePriorityChange = (priority: Thought['priority']) => {
    updateThought(thought.id, { priority });
    setSubmenu(null);
  };

  const handleStackAction = (stackId: string | null) => {
    updateThought(thought.id, { stackId });
    setSubmenu(null);
  };

  const handleCreateStack = () => {
    const name = prompt('Enter collection name:');
    if (name?.trim()) {
      createStack(name.trim(), thought.id);
    }
    setSubmenu(null);
  };

  const handleOpenEditor = () => {
    const triggers: Record<string, Thought['type']> = {
      text: 'text', tasks: 'tasks', table: 'table', paint: 'paint', embed: 'embed', file: 'file', image: 'file'
    };
    const focusType = (triggers[thought.type] || 'text') as 'text' | 'table' | 'paint' | 'tasks' | 'embed' | 'file' | null;
    setActiveFocus(thought.id, focusType);
    onClose();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        const trigger = triggerRef.current;
        if (!trigger || !trigger.contains(e.target as Node)) {
          onClose();
          setSubmenu(null);
        }
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, triggerRef]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (submenu) setSubmenu(null);
        else onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, submenu, onClose]);

  const currentStack = stacks.find(s => s.id === thought.stackId);

  const renderSubmenu = () => {
    switch (submenu) {
      case 'status':
        return (
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            className="absolute inset-0 bg-[var(--glass-bg)]/95 backdrop-blur-2xl rounded-[1.5rem] border border-[var(--glass-border)] p-4"
          >
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setSubmenu(null)} className="p-1 hover:bg-[var(--text-primary)]/10 rounded-lg">
                <ChevronRight className="w-4 h-4 rotate-180 text-[var(--text-muted)]" />
              </button>
              <span className="text-[10px] font-semibold tracking-wide text-[var(--text-primary)]">Set Status</span>
            </div>
            <div className="space-y-1">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  disabled={isReadOnly}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                    thought.status === opt.value
                      ? "bg-[var(--accent)]/10 border border-[var(--accent)]/30"
                      : "hover:bg-[var(--text-primary)]/5 border border-transparent"
                  )}
                >
                  <div className={cn("w-2.5 h-2.5 rounded-full", opt.color)} />
                  <span className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)]">{opt.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 'priority':
        return (
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            className="absolute inset-0 bg-[var(--glass-bg)]/95 backdrop-blur-2xl rounded-[1.5rem] border border-[var(--glass-border)] p-4"
          >
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setSubmenu(null)} className="p-1 hover:bg-[var(--text-primary)]/10 rounded-lg">
                <ChevronRight className="w-4 h-4 rotate-180 text-[var(--text-muted)]" />
              </button>
              <span className="text-[10px] font-semibold tracking-wide text-[var(--text-primary)]">Set Priority</span>
            </div>
            <div className="space-y-1">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handlePriorityChange(opt.value)}
                  disabled={isReadOnly}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                    thought.priority === opt.value
                      ? "bg-[var(--accent)]/10 border border-[var(--accent)]/30"
                      : "hover:bg-[var(--text-primary)]/5 border border-transparent"
                  )}
                >
                  <div className={cn("w-2.5 h-2.5 rounded-full", opt.color)} />
                  <span className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)]">{opt.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 'type':
        return (
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            className="absolute inset-0 bg-[var(--glass-bg)]/95 backdrop-blur-2xl rounded-[1.5rem] border border-[var(--glass-border)] p-4 overflow-y-auto"
          >
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setSubmenu(null)} className="p-1 hover:bg-[var(--text-primary)]/10 rounded-lg">
                <ChevronRight className="w-4 h-4 rotate-180 text-[var(--text-muted)]" />
              </button>
              <span className="text-[10px] font-semibold tracking-wide text-[var(--text-primary)]">Change Type</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(typeIcons) as Thought['type'][]).map((type) => {
                const Icon = typeIcons[type];
                return (
                  <button
                    key={type}
                    onClick={() => handleTypeChange(type)}
                    disabled={isReadOnly}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl transition-all",
                      thought.type === type
                        ? "bg-[var(--accent)]/10 border border-[var(--accent)]/30"
                        : "hover:bg-[var(--text-primary)]/5 border border-transparent"
                    )}
                  >
                    <Icon className="w-5 h-5 text-[var(--text-muted)]" />
                    <span className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)]">{type}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        );

      case 'stack':
        return (
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            className="absolute inset-0 bg-[var(--glass-bg)]/95 backdrop-blur-2xl rounded-[1.5rem] border border-[var(--glass-border)] p-4 overflow-y-auto"
          >
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setSubmenu(null)} className="p-1 hover:bg-[var(--text-primary)]/10 rounded-lg">
                <ChevronRight className="w-4 h-4 rotate-180 text-[var(--text-muted)]" />
              </button>
              <span className="text-[10px] font-semibold tracking-wide text-[var(--text-primary)]">Collection</span>
            </div>
            
            <button
              onClick={handleCreateStack}
              disabled={isReadOnly}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--text-primary)]/5 border border-dashed border-[var(--glass-border)] transition-all mb-3"
            >
              <FolderPlus className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)]">New Collection</span>
            </button>

            {currentStack && (
              <button
                onClick={() => handleStackAction(null)}
                disabled={isReadOnly}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 border border-transparent transition-all mb-3"
              >
                <Unlink className="w-4 h-4 text-red-400" />
                <span className="text-[10px] font-semibold tracking-wide text-red-400">Remove from Collection</span>
              </button>
            )}

            {stacks.length > 0 && (
              <div className="space-y-1">
                {stacks.map((stack) => (
                  <button
                    key={stack.id}
                    onClick={() => handleStackAction(stack.id)}
                    disabled={isReadOnly}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                      thought.stackId === stack.id
                        ? "bg-[var(--accent)]/10 border border-[var(--accent)]/30"
                        : "hover:bg-[var(--text-primary)]/5 border border-transparent"
                    )}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stack.color }} />
                    <span className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)] truncate">{stack.name}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="absolute top-0 right-0 z-[100] w-[280px] bg-[var(--glass-bg)]/95 backdrop-blur-2xl rounded-[1.5rem] border border-[var(--glass-border)] shadow-2xl overflow-hidden"
        style={{ transformOrigin: 'top right' }}
      >
        <AnimatePresence mode="wait">
          {submenu ? (
            renderSubmenu()
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-2"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b border-[var(--glass-border)] mb-2">
                <span className="text-[9px] font-semibold tracking-wide text-[var(--text-muted)]">Actions</span>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-[var(--text-primary)]/10 rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>
              </div>

              {/* Quick Actions */}
              <div className="space-y-0.5">
                {/* Status */}
                <button
                  onClick={() => setSubmenu('status')}
                  disabled={isReadOnly}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[var(--text-primary)]/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    {(() => {
                      const opt = statusOptions.find(s => s.value === thought.status);
                      if (!opt) return <ListTodo className="w-4 h-4 text-[var(--text-muted)]" />;
                      const Icon = opt.icon;
                      return <Icon className={cn("w-4 h-4", opt.iconColor)} />;
                    })()}
                    <span className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)]">Status</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-medium text-[var(--text-muted)] uppercase">
                      {statusOptions.find(s => s.value === thought.status)?.label}
                    </span>
                    <ChevronRight className="w-3 h-3 text-[var(--text-dimmed)] group-hover:text-[var(--text-primary)] transition-colors" />
                  </div>
                </button>

                {/* Priority */}
                <button
                  onClick={() => setSubmenu('priority')}
                  disabled={isReadOnly}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[var(--text-primary)]/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <Star className={cn("w-4 h-4", thought.priority !== 'none' ? 'text-yellow-400' : 'text-[var(--text-muted)]')} />
                    <span className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)]">Priority</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-medium text-[var(--text-muted)] uppercase">
                      {priorityOptions.find(p => p.value === thought.priority)?.label}
                    </span>
                    <ChevronRight className="w-3 h-3 text-[var(--text-dimmed)] group-hover:text-[var(--text-primary)] transition-colors" />
                  </div>
                </button>

                {/* Type */}
                <button
                  onClick={() => setSubmenu('type')}
                  disabled={isReadOnly}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[var(--text-primary)]/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    {React.createElement(typeIcons[thought.type], { className: "w-4 h-4 text-[var(--text-muted)]" })}
                    <span className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)]">Type</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-medium text-[var(--text-muted)] uppercase">{thought.type}</span>
                    <ChevronRight className="w-3 h-3 text-[var(--text-dimmed)] group-hover:text-[var(--text-primary)] transition-colors" />
                  </div>
                </button>

                {/* Stack */}
                <button
                  onClick={() => setSubmenu('stack')}
                  disabled={isReadOnly}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[var(--text-primary)]/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    {currentStack ? (
                      <div className="w-4 h-4 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStack.color }} />
                      </div>
                    ) : (
                      <Folder className="w-4 h-4 text-[var(--text-muted)]" />
                    )}
                    <span className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)]">Collection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-medium text-[var(--text-muted)] uppercase truncate max-w-[100px]">
                      {currentStack?.name || 'None'}
                    </span>
                    <ChevronRight className="w-3 h-3 text-[var(--text-dimmed)] group-hover:text-[var(--text-primary)] transition-colors" />
                  </div>
                </button>
              </div>

              {/* Divider */}
              <div className="border-t border-[var(--glass-border)] my-2" />

              {/* Layer Actions */}
              <div className="space-y-0.5">
                <button
                  onClick={() => { bringToFront(thought.id); onClose(); }}
                  disabled={isReadOnly}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--text-primary)]/5 transition-all"
                >
                  <ArrowUp className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)]">Bring to Front</span>
                </button>
                <button
                  onClick={() => { sendToBack(thought.id); onClose(); }}
                  disabled={isReadOnly}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--text-primary)]/5 transition-all"
                >
                  <ArrowDown className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)]">Send to Back</span>
                </button>
              </div>

              {/* Divider */}
              <div className="border-t border-[var(--glass-border)] my-2" />

              {/* Open Editor */}
              {thought.type !== 'label' && (
                <button
                  onClick={handleOpenEditor}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--text-primary)]/5 transition-all"
                >
                  <Maximize2 className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)]">Open Full Editor</span>
                </button>
              )}

              {/* Divider */}
              <div className="border-t border-[var(--glass-border)] my-2" />

              {/* Delete */}
              <button
                onClick={handleDelete}
                disabled={isReadOnly}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 transition-all group"
              >
                <Trash2 className="w-4 h-4 text-[var(--text-muted)] group-hover:text-red-400 transition-colors" />
                <span className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] group-hover:text-red-400 transition-colors">Delete</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default NodeMenu;
