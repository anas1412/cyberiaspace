import React from 'react';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import { X, Link, Trash2, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MultiSelectionMenu: React.FC = () => {
  const selectedThoughtIds = useStore((state) => state.selectedThoughtIds);
  const clearSelection = useStore((state) => state.clearSelection);
  const deleteSelectedThoughts = useStore((state) => state.deleteSelectedThoughts);
  const linkSelectedThoughts = useStore((state) => state.linkSelectedThoughts);
  const unlinkSelectedThoughts = useStore((state) => state.unlinkSelectedThoughts);
  const thoughts = useStore((state) => state.thoughts);
  const updateThought = useStore((state) => state.updateThought);
  
  const { openModal } = useModalStore();

  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  const areLinked = React.useMemo(() => {
    if (selectedThoughtIds.length < 2) return false;
    const selectedThoughts = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    if (selectedThoughts.length < selectedThoughtIds.length) return false;
    
    // Find stack tags of the first thought
    const stackTags = selectedThoughts[0].tags.filter(tag => tag.startsWith('stack-'));
    
    // Check if any of these stack tags are present in ALL selected thoughts
    return stackTags.some(tag => 
      selectedThoughts.every(t => t.tags.includes(tag))
    );
  }, [selectedThoughtIds, thoughts]);

  const handleDeleteAll = () => {
    openModal({
      title: `Delete ${selectedThoughtIds.length} Thoughts?`,
      description: 'This action cannot be undone.',
      type: 'delete_thought',
      confirmText: 'Delete All',
      onConfirm: () => deleteSelectedThoughts()
    });
  };

  const handleBulkTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && e.currentTarget.value.trim()) {
      e.preventDefault();
      const newTag = e.currentTarget.value.trim().replace(',', '');
      
      selectedThoughtIds.forEach(id => {
        const thought = thoughts.find(t => t.id === id);
        if (thought && !thought.tags.includes(newTag)) {
          updateThought(id, { tags: [...thought.tags, newTag] });
        }
      });
      
      e.currentTarget.value = '';
    }
  };

  if (selectedThoughtIds.length < 2) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={isMobile ? { y: '100%' } : { opacity: 0, x: 20 }}
        animate={isMobile ? { y: 0 } : { opacity: 1, x: 0 }}
        exit={isMobile ? { y: '100%' } : { opacity: 0, x: 20 }}
        className="ui-layer fixed bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:top-[120px] md:right-8 w-full md:w-80 glass rounded-t-[2.5rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl pointer-events-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">Bulk Actions</h3>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{selectedThoughtIds.length} items selected</span>
          </div>
          <button onClick={clearSelection} className="text-slate-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {areLinked ? (
            <button 
              onClick={unlinkSelectedThoughts}
              className="w-full bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
            >
              <Link className="w-4 h-4 rotate-45" />
              Unlink Selected
            </button>
          ) : (
            <button 
              onClick={linkSelectedThoughts}
              className="w-full bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-[var(--accent-secondary)] py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
            >
              <Link className="w-4 h-4" />
              Link Selected
            </button>
          )}

          <div className="space-y-2">
            <label className="text-[9px] uppercase font-bold tracking-widest text-slate-500 ml-1">Add Common Tag</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
              <input
                type="text"
                onKeyDown={handleBulkTag}
                placeholder="Type and press Enter..."
                className="w-full bg-[var(--bg-page)]/20 border border-white/10 rounded-xl p-3 pl-10 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)] placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/5">
            <button 
              onClick={handleDeleteAll}
              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-3"
            >
              <Trash2 className="w-4 h-4" />
              Delete All
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MultiSelectionMenu;