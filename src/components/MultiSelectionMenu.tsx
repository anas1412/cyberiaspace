import React from 'react';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import { X, Trash2, Calendar, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BatchDatePicker: React.FC<{ onSelect: (val: string) => void }> = ({ onSelect }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState(new Date());
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[var(--bg-page)]/20 border border-white/10 rounded-xl p-3 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white flex items-center justify-between transition-all group"
      >
        <span>Set Batch Date</span>
        <Calendar className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full mt-2 left-0 right-0 z-[100] glass border border-white/10 rounded-2xl p-4 shadow-2xl overflow-hidden"
          >
            <div className="flex justify-between items-center mb-4">
              <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))} className="p-1 hover:bg-white/10 rounded-lg text-slate-400">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h4 className="text-[9px] font-black uppercase tracking-widest text-white">{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</h4>
              <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))} className="p-1 hover:bg-white/10 rounded-lg text-slate-400">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => <div key={i} />)}
              {Array.from({ length: daysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => { onSelect(new Date(viewDate.getFullYear(), viewDate.getMonth(), i + 1).toLocaleDateString('en-CA')); setIsOpen(false); }}
                  className="w-full aspect-square rounded-lg text-[9px] font-bold text-slate-400 hover:bg-blue-500/20 hover:text-white transition-all"
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button onClick={() => { onSelect(""); setIsOpen(false); }} className="w-full mt-4 py-2 bg-white/5 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-500">Unschedule All</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MultiSelectionMenu: React.FC = () => {
  const selectedThoughtIds = useStore((state) => state.selectedThoughtIds);
  const isReadOnly = useStore((state) => state.isReadOnly);
  const clearSelection = useStore((state) => state.clearSelection);
  const updateThoughts = useStore((state) => state.updateThoughts);
  const linkSelectedThoughts = useStore((state) => state.linkSelectedThoughts);
  const unlinkSelectedThoughts = useStore((state) => state.unlinkSelectedThoughts);
  const deleteSelectedThoughts = useStore((state) => state.deleteSelectedThoughts);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const isInspectorOpen = useStore((state) => state.isInspectorOpen);

  const isChatOpen = useStore((state) => state.isChatOpen);

  const { openModal } = useModalStore();
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  const sharedStack = React.useMemo(() => {
    if (selectedThoughtIds.length < 2) return null;
    const selectedThoughts = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    const firstStackId = selectedThoughts[0]?.stackId;
    if (!firstStackId) return null;
    return selectedThoughts.every(t => t.stackId === firstStackId) ? stacks.find(s => s.id === firstStackId) || null : null;
  }, [selectedThoughtIds, thoughts, stacks]);

  const [localStackName, setLocalStackName] = React.useState('');
  React.useEffect(() => setLocalStackName(sharedStack?.name || ''), [sharedStack]);

  if (selectedThoughtIds.length < 2 || isReadOnly) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={isMobile ? { y: '100%' } : { opacity: 0, x: -20 }}
        animate={isMobile ? (isInspectorOpen || isChatOpen ? { y: '100%', opacity: 0 } : { y: 0, opacity: 1 }) : { opacity: 1, x: 0 }}
        exit={isMobile ? { y: '100%' } : { opacity: 0, x: -20 }}
        className="ui-layer focus-box fixed top-4 md:top-24 bottom-4 md:bottom-24 left-4 md:left-8 w-[calc(100%-32px)] md:w-[400px] glass md:rounded-[2rem] shadow-[0_0_80px_rgba(0,0,0,0.5)] pointer-events-auto z-[9999] border border-white/10 flex flex-col overflow-hidden"
      >
        {/* MATCHING HEADER STYLE */}
        <div className="p-4 md:p-5 border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-20">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
                <Layers className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white leading-none">Bulk Actions</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none">{selectedThoughtIds.length} Nodes Selected</span>
                </div>
              </div>
            </div>
            <button onClick={clearSelection} className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll p-4 md:p-6 space-y-6">
          {/* 1. Status Batch */}
          <div className="space-y-3">
            <label className="text-[9px] uppercase font-bold tracking-widest text-slate-500 ml-1">Batch Status</label>
            <div className="grid grid-cols-4 gap-1">
              {(['none', 'todo', 'doing', 'done'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => updateThoughts(selectedThoughtIds, { status: s })}
                  className="py-2.5 rounded-lg border border-white/10 bg-white/[0.03] text-[8px] font-bold uppercase text-slate-400 hover:bg-white/10 hover:text-white transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Priority Batch */}
          <div className="space-y-3">
            <label className="text-[9px] uppercase font-bold tracking-widest text-slate-500 ml-1">Batch Priority</label>
            <div className="grid grid-cols-5 gap-1">
              {(['none', 'low', 'medium', 'high', 'urgent'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => updateThoughts(selectedThoughtIds, { priority: p })}
                  className="py-2.5 rounded-lg border border-white/10 bg-white/[0.03] text-[8px] font-bold uppercase text-slate-400 hover:bg-white/10 hover:text-white transition-all"
                >
                  {p === 'medium' ? 'Med' : p}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Date Batch */}
          <div className="space-y-3">
            <label className="text-[9px] uppercase font-bold tracking-widest text-slate-500 ml-1">Temporal Alignment</label>
            <BatchDatePicker onSelect={(date) => updateThoughts(selectedThoughtIds, { date })} />
          </div>

          {/* 4. Stack Management */}
          <div className="space-y-3 pt-4 border-t border-white/5">
            <label className="text-[9px] uppercase font-bold tracking-widest text-slate-500 ml-1">Collection</label>
            <div className="p-4 bg-[var(--bg-page)]/20 border border-white/10 rounded-2xl space-y-4">
              <input
                type="text"
                value={localStackName}
                onChange={(e) => setLocalStackName(e.target.value)}
                placeholder="Name your collection..."
                className="w-full bg-transparent text-[10px] font-black uppercase tracking-widest text-white outline-none border-b border-white/5 pb-2"
              />
              <button
                onClick={async () => {
                  if (sharedStack && localStackName.trim() !== sharedStack.name) {
                    await linkSelectedThoughts(localStackName.trim());
                  } else if (!sharedStack) {
                    await linkSelectedThoughts(localStackName.trim());
                  }
                }}
                disabled={!!sharedStack && localStackName.trim() === sharedStack.name}
                className="w-full py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {sharedStack ? 'Rename Collection' : 'Link into New Collection'}
              </button>

              {stacks.length > 0 && !sharedStack && (
                <div className="space-y-1.5 pt-2">
                  <label className="text-[7px] uppercase font-black tracking-[0.2em] text-slate-600 ml-1">Add to Existing</label>
                  <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto custom-scroll pr-1">
                    {stacks.map(s => (
                      <button
                        key={s.id}
                        onClick={() => updateThoughts(selectedThoughtIds, { stackId: s.id })}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-transparent hover:border-white/5 transition-all text-left"
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}44` }} />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors">{s.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {sharedStack && (
                <button onClick={unlinkSelectedThoughts} className="w-full py-2 bg-white/5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 border border-white/5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all">Dissolve Collection</button>
              )}
            </div>
          </div>

        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 md:p-6 bg-black/40 border-t border-white/5 mt-auto">
          <button
            onClick={() => openModal({ title: `Purge ${selectedThoughtIds.length} Nodes?`, description: 'This action is permanent and clears them from all views.', type: 'delete_thought', confirmText: 'Purge Selected', onConfirm: () => deleteSelectedThoughts() })}
            className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 group"
          >
            <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
            Purge Selected
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MultiSelectionMenu;