import React from 'react';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import { X, Link, Trash2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MultiSelectionMenu: React.FC = () => {
  const selectedThoughtIds = useStore((state) => state.selectedThoughtIds);
  const isReadOnly = useStore((state) => state.isReadOnly);
  const clearSelection = useStore((state) => state.clearSelection);
  const deleteSelectedThoughts = useStore((state) => state.deleteSelectedThoughts);
  const linkSelectedThoughts = useStore((state) => state.linkSelectedThoughts);
  const unlinkSelectedThoughts = useStore((state) => state.unlinkSelectedThoughts);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const updateStack = useStore((state) => state.updateStack);
  const isInspectorOpen = useStore((state) => state.isInspectorOpen);
  const isChatOpen = useStore((state) => state.isChatOpen);

  const { openModal } = useModalStore();

  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  const sharedStack = React.useMemo(() => {
    if (selectedThoughtIds.length < 2) return null;
    const selectedThoughts = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    const firstStackId = selectedThoughts[0]?.stackId;
    if (!firstStackId) return null;
    if (selectedThoughts.every(t => t.stackId === firstStackId)) {
      return stacks.find(s => s.id === firstStackId) || null;
    }
    return null;
  }, [selectedThoughtIds, thoughts, stacks]);

  const areLinked = !!sharedStack;
  const [localStackName, setLocalStackName] = React.useState('');

  React.useEffect(() => {
    if (sharedStack) {
      setLocalStackName(sharedStack.name);
    } else {
      setLocalStackName('');
    }
  }, [sharedStack]);

  const handleDeleteAll = () => {
    openModal({
      title: `Delete ${selectedThoughtIds.length} Thoughts?`,
      description: 'This action cannot be undone.',
      type: 'delete_thought',
      confirmText: 'Delete All',
      onConfirm: () => deleteSelectedThoughts()
    });
  };

  if (selectedThoughtIds.length < 2 || isReadOnly) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={isMobile ? { y: '100%' } : { opacity: 0, x: -20 }}
        animate={isMobile
          ? (isInspectorOpen || isChatOpen ? { y: '100%', opacity: 0 } : { y: 0, opacity: 1 })
          : { opacity: 1, x: 0 }}
        exit={isMobile ? { y: '100%' } : { opacity: 0, x: -20 }}
        className={cn(
          "ui-layer focus-box fixed bottom-4 left-4 right-4 md:bottom-auto md:left-8 md:top-24 w-[calc(100%-32px)] md:w-80 glass md:rounded-[2rem] p-4 md:p-5 shadow-[0_0_80px_rgba(0,0,0,0.5)] pointer-events-auto z-[9999] border border-white/10",
          isMobile && (isInspectorOpen || isChatOpen) && "pointer-events-none"
        )}
      >
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <Link className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white leading-none">Bulk Actions</h3>
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-1.5">{selectedThoughtIds.length} items selected</span>
            </div>
          </div>
          <button onClick={clearSelection} className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[8px] uppercase font-bold tracking-widest text-slate-500 ml-1">
              {areLinked ? "Stack Name" : "Create Named Stack"}
            </label>
            <div className="p-2.5 bg-[var(--bg-page)]/20 border border-white/10 rounded-xl flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full shadow-[0_0_10px_currentColor]"
                style={{
                  backgroundColor: sharedStack?.color || 'var(--accent)',
                  color: sharedStack?.color || 'var(--accent)'
                }}
              />
              <input
                type="text"
                value={localStackName}
                onChange={(e) => setLocalStackName(e.target.value)}
                onBlur={() => {
                  if (areLinked && sharedStack && localStackName.trim()) {
                    updateStack(sharedStack.id, { name: localStackName.trim() });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && localStackName.trim()) {
                    if (areLinked && sharedStack) {
                      updateStack(sharedStack.id, { name: localStackName.trim() });
                    } else {
                      linkSelectedThoughts();
                    }
                  }
                }}
                placeholder={areLinked ? "Rename Stack..." : "Name your stack..."}
                className="bg-transparent text-[9px] font-black uppercase tracking-widest text-white outline-none flex-1"
              />
            </div>
          </div>

          {areLinked ? (
            <button
              onClick={unlinkSelectedThoughts}
              className="w-full bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2.5"
            >
              <Link className="w-3.5 h-3.5 rotate-45" />
              Remove from Stack
            </button>
          ) : (
            <button
              onClick={async () => {
                await linkSelectedThoughts();
                if (localStackName.trim()) {
                  setTimeout(async () => {
                    const latestThoughts = useStore.getState().thoughts;
                    const firstSelected = latestThoughts.find(t => selectedThoughtIds.includes(t.id));
                    if (firstSelected?.stackId) {
                      await useStore.getState().updateStack(firstSelected.stackId, { name: localStackName.trim() });
                    }
                  }, 100);
                }
              }}
              className="w-full bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-[var(--accent-secondary)] py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2.5"
            >
              <Link className="w-3.5 h-3.5" />
              Link into Stack
            </button>
          )}

          <div className="pt-3 border-t border-white/5">
            <button
              onClick={handleDeleteAll}
              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 py-3 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete All
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MultiSelectionMenu;