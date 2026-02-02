import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Layout, Zap, Download, Upload, SlidersHorizontal, ChevronLeft, ChevronRight, Trash2, Edit3 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Toolbar: React.FC = () => {
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);
  const thoughts = useStore((state) => state.thoughts);
  const setActiveSpace = useStore((state) => state.setActiveSpace);
  const addThought = useStore((state) => state.addThought);
  const updateSpace = useStore((state) => state.updateSpace);
  const deleteSpace = useStore((state) => state.deleteSpace);
  const addSpace = useStore((state) => state.addSpace);
  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const [isSpaceMenuOpen, setIsSpaceMenuOpen] = useState(false);

  const handleAddThought = async () => {
    const id = await addThought({});
    setSelectedThoughtId(id);
    setInspectorOpen(true);
  };

  const handleToggleView = () => {
    if (!activeSpace) return;
    const modes: ('spatial' | 'kanban' | 'calendar')[] = ['spatial', 'kanban', 'calendar'];
    const currentIndex = modes.indexOf(activeSpace.mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    updateSpace(activeSpace.id, { mode: nextMode });
  };

  const handleTogglePhysics = () => {
    if (!activeSpace) return;
    updateSpace(activeSpace.id, { physics: !activeSpace.physics });
  };

  return (
    <>
      {/* TOP UI */}
      <div className="ui-layer top-8 left-8 right-8 flex items-center justify-between pointer-events-none fixed z-[9999]">
        <div className="pointer-events-auto flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter text-white">Thoughtist</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-black truncate max-w-[120px]">
                {activeSpace?.name || 'Space'}
              </p>
              <button 
                onClick={() => setIsSpaceMenuOpen(!isSpaceMenuOpen)}
                className="p-1 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
              >
                <SlidersHorizontal className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
          
          <div className={cn(
            "glass p-2 rounded-2xl flex items-center gap-1 transition-all",
            isSpaceMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}>
            <button className="p-2 hover:bg-white/5 rounded-xl text-slate-300"><Edit3 className="w-3.5 h-3.5" /></button>
            <button className="p-2 hover:bg-white/5 rounded-xl text-slate-300"><ChevronLeft className="w-3.5 h-3.5" /></button>
            <button className="p-2 hover:bg-white/5 rounded-xl text-slate-300"><ChevronRight className="w-3.5 h-3.5" /></button>
            <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
            <button 
              onClick={() => activeSpace && deleteSpace(activeSpace.id)}
              className="p-2 hover:bg-red-500/10 rounded-xl transition-colors text-red-500"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar max-w-[40%] pointer-events-auto">
          {spaces.map((space) => (
            <button
              key={space.id}
              onClick={() => setActiveSpace(space.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] uppercase font-black flex-shrink-0 transition-all",
                space.id === activeSpaceId 
                  ? "bg-indigo-500 text-white shadow-[0_10px_20px_-5px_rgba(99,102,241,0.4)]" 
                  : "text-slate-500 hover:text-white hover:bg-white/5"
              )}
            >
              {space.name}
            </button>
          ))}
        </div>

        <div className="flex gap-2 pointer-events-auto">
          <button 
            onClick={handleAddThought}
            className="glass py-3 px-5 rounded-2xl flex items-center gap-3 hover:bg-white/5 transition-all text-white"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider">New Thought</span>
          </button>
          <button 
            onClick={handleToggleView}
            className="glass py-3 px-5 rounded-2xl flex items-center gap-3 hover:bg-white/5 transition-all text-white"
          >
            <Layout className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-wider">
              {activeSpace?.mode === 'spatial' ? 'Kanban' : activeSpace?.mode === 'kanban' ? 'Calendar' : 'Spatial'}
            </span>
          </button>
        </div>
      </div>

      {/* BOTTOM UI */}
      <div className="ui-layer bottom-8 left-1/2 -translate-x-1/2 glass px-8 py-4 rounded-full flex gap-8 items-center text-[10px] uppercase font-bold tracking-widest text-slate-500 fixed z-[9999]">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]"></span> 
          <span className="text-white"><span>{thoughts.length}</span>/40 Thoughts</span>
        </div>
        <div className="h-4 w-[1px] bg-white/10"></div>
        <button 
          onClick={handleTogglePhysics}
          className={cn(
            "flex items-center gap-2 transition-all",
            activeSpace?.physics ? "text-indigo-400" : "text-slate-600"
          )}
        >
          <Zap className="w-3.5 h-3.5" /> 
          <span>Physics {activeSpace?.physics ? 'On' : 'Off'}</span>
        </button>
        <button className="hover:text-white flex items-center gap-2 transition-colors">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
        <label className="flex items-center gap-2 cursor-pointer hover:text-white">
          <Upload className="w-3.5 h-3.5" /> Import 
          <input type="file" className="hidden" accept=".json" />
        </label>
        <div className="h-4 w-[1px] bg-white/10"></div>
        <button 
          onClick={() => addSpace('New Space')}
          className="text-indigo-400 hover:text-white transition-all"
        >
          + New Space (<span>{spaces.length}</span>/8)
        </button>
      </div>
    </>
  );
};

export default Toolbar;
