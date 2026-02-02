import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useModalStore } from './Modal';
import { LIMITS } from '../constants';
import { Plus, Layout, Zap, Download, Upload, SlidersHorizontal, ChevronLeft, ChevronRight, Trash2, Edit3, Camera, MoreVertical, Keyboard, MousePointer2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toPng } from 'html-to-image';

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
  const reorderSpaces = useStore((state) => state.reorderSpaces);
  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  const exportData = useStore((state) => state.exportData);
  const importData = useStore((state) => state.importData);
  
  const { openModal } = useModalStore();
  
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const [isSpaceMenuOpen, setIsSpaceMenuOpen] = useState(false);
  const [isSystemMenuOpen, setIsSystemMenuOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleExport = () => {
    exportData();
    setIsSystemMenuOpen(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importData(file);
    }
    setIsSystemMenuOpen(false);
  };

  const handleScreenshot = async () => {
    setIsSystemMenuOpen(false);
    const worldEl = document.getElementById('world');
    if (!worldEl || thoughts.length === 0) return;

    setIsCapturing(true);
    
    try {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      thoughts.forEach(t => {
        const el = document.querySelector(`.thought-bulb[data-id="${t.id}"]`) as HTMLElement;
        const width = 280;
        const height = el?.offsetHeight || 200;
        
        const x = t.x - 140; 
        const y = t.y - height / 2;
        
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + width > maxX) maxX = x + width;
        if (y + height > maxY) maxY = y + height;
      });

      const padding = 100;
      minX -= padding; minY -= padding; maxX += padding; maxY += padding;
      const width = maxX - minX; const height = maxY - minY;

      const dataUrl = await toPng(worldEl, {
        backgroundColor: '#020408',
        style: {
          transform: `translate(${-minX}px, ${-minY}px) scale(1)`,
          position: 'absolute',
          width: `${width}px`,
          height: `${height}px`,
          margin: '0', padding: '0', left: '0', top: '0'
        },
        width: width,
        height: height,
        filter: (node: any) => {
          const isUI = node.classList?.contains('ui-layer') || 
                       node.id === 'connection-canvas' ||
                       node.tagName === 'BUTTON' && !node.closest?.('.thought-bulb');
          return !isUI;
        }
      });

      const link = document.createElement('a');
      link.download = `thoughtist_${activeSpace?.name || 'space'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Screenshot failed:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleAddThought = async () => {
    if (thoughts.length >= LIMITS.MAX_THOUGHTS_PER_SPACE) {
      openModal({
        title: 'Limit Reached',
        description: `You have reached the maximum of ${LIMITS.MAX_THOUGHTS_PER_SPACE} thoughts per space.`,
        type: 'limit_thought',
        confirmText: 'Okay'
      });
      return;
    }
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

  const handleRenameSpace = () => {
    if (!activeSpace) return;
    openModal({
      title: 'Rename Space',
      type: 'rename',
      inputValue: activeSpace.name,
      confirmText: 'Rename',
      onConfirm: (newName) => {
        if (newName && newName.trim()) {
          updateSpace(activeSpace.id, { name: newName.substring(0, 15) });
        }
      }
    });
    setIsSpaceMenuOpen(false);
  };

  const handleCreateSpace = () => {
    if (spaces.length >= LIMITS.MAX_SPACES) {
      openModal({
        title: 'Limit Reached',
        description: `You can only have up to ${LIMITS.MAX_SPACES} spaces.`,
        type: 'limit_space',
        confirmText: 'Okay'
      });
      return;
    }
    openModal({
      title: 'New Space',
      type: 'new_space',
      confirmText: 'Create',
      onConfirm: (name) => {
        addSpace(name && name.trim() ? name.substring(0, 15) : 'New Space');
      }
    });
  };

  const handleDeleteSpace = () => {
    if (!activeSpace) return;
    if (spaces.length <= LIMITS.MIN_SPACES) {
      openModal({
        title: 'Cannot Delete',
        description: `You must have at least ${LIMITS.MIN_SPACES} active space.`,
        type: 'alert',
        confirmText: 'Okay'
      });
      return;
    }
    openModal({
      title: 'Delete Space',
      description: 'Are you sure? This will delete all thoughts in this space.',
      type: 'delete_space',
      confirmText: 'Delete',
      onConfirm: () => {
        deleteSpace(activeSpace.id);
      }
    });
    setIsSpaceMenuOpen(false);
  };

  const handleMoveSpace = (dir: number) => {
    if (!activeSpace) return;
    const currentIndex = spaces.findIndex(s => s.id === activeSpaceId);
    const newIndex = currentIndex + dir;
    
    if (newIndex >= 0 && newIndex < spaces.length) {
      const newSpaces = [...spaces];
      [newSpaces[currentIndex], newSpaces[newIndex]] = [newSpaces[newIndex], newSpaces[currentIndex]];
      reorderSpaces(newSpaces);
    }
  };

  return (
    <>
      {/* TOP UI */}
      <div className="ui-layer top-8 left-8 right-8 flex items-center justify-between pointer-events-none fixed z-[9999]">
        {/* LEFT SIDE: Logo & Settings */}
        <div className="pointer-events-auto flex items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter text-white">Thoughtist</h1>
            <div className="flex items-center gap-3 mt-1 group cursor-pointer" onClick={() => setIsSpaceMenuOpen(!isSpaceMenuOpen)}>
              <div className={cn(
                "w-2 h-2 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]",
                isSpaceMenuOpen ? "bg-indigo-400 scale-125" : "bg-indigo-500/40"
              )} />
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-indigo-400/80 group-hover:text-indigo-300 transition-colors">
                {activeSpace?.name || 'Space'}
              </p>
              <SlidersHorizontal className={cn("w-3 h-3 text-white/20 group-hover:text-white/60 transition-all", isSpaceMenuOpen && "text-indigo-400 rotate-90")} />
            </div>
          </div>
          
          <div className={cn(
            "glass p-1.5 rounded-2xl flex items-center gap-1 transition-all duration-500 border border-white/5",
            isSpaceMenuOpen ? "opacity-100 translate-x-0 scale-100" : "opacity-0 -translate-x-8 scale-90 pointer-events-none"
          )}>
            <div className="flex items-center gap-1 px-1">
              <button onClick={handleRenameSpace} className="p-2.5 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all" title="Rename Space"><Edit3 className="w-4 h-4" /></button>
              <button onClick={() => handleMoveSpace(-1)} className="p-2.5 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all" title="Move Left"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => handleMoveSpace(1)} className="p-2.5 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all" title="Move Right"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="w-[1px] h-6 bg-white/5 mx-1"></div>
            <button 
              onClick={handleDeleteSpace}
              className="p-2.5 hover:bg-red-500/10 rounded-xl transition-all text-red-500/50 hover:text-red-400"
              title="Delete Space"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CENTER: Space Switcher (Dynamically Centered) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-[#020617]/40 backdrop-blur-2xl rounded-[20px] border border-white/5 overflow-x-auto no-scrollbar max-w-[40%] pointer-events-auto shadow-2xl transition-all">
          {spaces.map((space) => (
            <button
              key={space.id}
              onClick={() => setActiveSpace(space.id)}
              className={cn(
                "px-5 py-2.5 rounded-2xl text-[10px] uppercase font-black tracking-widest flex-shrink-0 transition-all duration-300",
                space.id === activeSpaceId 
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]" 
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] border border-transparent"
              )}
            >
              {space.name}
            </button>
          ))}
          <button 
            onClick={handleCreateSpace}
            className="w-10 h-10 rounded-xl text-[10px] uppercase font-black text-slate-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all flex-shrink-0 flex items-center justify-center border border-white/5 border-dashed"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* RIGHT SIDE: View Mode */}
        <div className="flex gap-2 pointer-events-auto">
          <button 
            onClick={handleToggleView}
            className="glass py-3 px-5 rounded-2xl flex items-center gap-3 hover:bg-white/5 transition-all text-white border border-white/5"
          >
            <Layout className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-wider">
              {activeSpace?.mode === 'spatial' ? 'Kanban' : activeSpace?.mode === 'kanban' ? 'Calendar' : 'Spatial'}
            </span>
          </button>
        </div>
      </div>

      {/* NEW THOUGHT FAB (Center Bottom) */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[10000] pointer-events-none flex flex-col items-center gap-4">
        <button 
          onClick={handleAddThought}
          className="pointer-events-auto group relative flex items-center justify-center w-20 h-20 bg-[#020617]/40 backdrop-blur-2xl text-white rounded-full border border-white/10 shadow-[0_0_50px_rgba(99,102,241,0.1)] transition-all hover:scale-110 active:scale-95 hover:border-indigo-500/40"
        >
          {/* Subtle aura effect */}
          <div className="absolute inset-0 rounded-full bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
          <Plus className="w-10 h-10 text-slate-400 group-hover:text-white transition-all group-hover:rotate-90 relative z-10" />
          
          <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 text-indigo-400 text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl pointer-events-none whitespace-nowrap shadow-2xl">
            New Thought <span className="text-white/20 ml-2 font-mono">SPACE</span>
          </div>
        </button>
      </div>

      {/* SYSTEM TRAY (Bottom Right) */}
      <div className="ui-layer bottom-8 right-8 flex flex-col items-end gap-3 pointer-events-none">
        <div className={cn(
          "glass p-2 rounded-2xl flex flex-col gap-1 transition-all pointer-events-auto",
          isSystemMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}>
          <button onClick={handleExport} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-colors">
            <Download className="w-4 h-4" /> Export Data
          </button>
          <label className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-colors cursor-pointer">
            <Upload className="w-4 h-4" /> Import Data
            <input type="file" className="hidden" accept=".json" onChange={handleImport} />
          </label>
          <button onClick={handleScreenshot} disabled={isCapturing} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition-colors">
            <Camera className="w-4 h-4" /> {isCapturing ? 'Capturing...' : 'Take Screenshot'}
          </button>
        </div>
        
        <div className="flex gap-2 pointer-events-auto">
          <button 
            onClick={() => setIsShortcutsOpen(!isShortcutsOpen)}
            className={cn(
              "glass p-4 rounded-2xl transition-all border border-white/5",
              isShortcutsOpen ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
            )}
          >
            <Keyboard className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsSystemMenuOpen(!isSystemMenuOpen)}
            className={cn(
              "glass p-4 rounded-2xl transition-all border border-white/5",
              isSystemMenuOpen ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
            )}
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* STATUS BAR (Bottom Left) */}
      <div className="ui-layer bottom-8 left-8 flex items-center gap-4 pointer-events-auto">
        <div className="glass px-6 py-4 rounded-2xl flex items-center gap-6 border border-white/5">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]"></span> 
            <span className="text-[10px] uppercase font-black tracking-widest text-white"><span>{thoughts.length}</span>/{LIMITS.MAX_THOUGHTS_PER_SPACE} Thoughts</span>
          </div>
          <div className="h-4 w-[1px] bg-white/10"></div>
          <button 
            onClick={handleTogglePhysics}
            className={cn(
              "flex items-center gap-2 transition-all text-[10px] font-black uppercase tracking-widest",
              activeSpace?.physics ? "text-indigo-400" : "text-slate-600"
            )}
          >
            <Zap className="w-3.5 h-3.5" /> 
            <span>Physics {activeSpace?.physics ? 'On' : 'Off'}</span>
          </button>
        </div>
      </div>

      {/* SHORTCUTS MODAL */}
      {isShortcutsOpen && (
        <div className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-md flex items-center justify-center p-10 pointer-events-auto" onClick={() => setIsShortcutsOpen(false)}>
          <div className="glass max-w-md w-full p-10 rounded-[3rem] border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-400">Command Center</h3>
              <button onClick={() => setIsShortcutsOpen(false)} className="text-slate-500 hover:text-white"><Plus className="w-6 h-6 rotate-45" /></button>
            </div>
            <div className="space-y-6">
              {[
                { keys: ['Space'], label: 'Create New Thought' },
                { keys: ['Del', 'Backspace'], label: 'Delete Selected Thought' },
                { keys: ['Enter'], label: 'Confirm Modal / Open Editor' },
                { keys: ['Alt', 'L-Click'], label: 'Pan Viewport' },
                { keys: ['Wheel'], label: 'Zoom In / Out' },
              ].map((s, i) => (
                <div key={i} className="flex justify-between items-center group">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">{s.label}</span>
                  <div className="flex gap-1">
                    {s.keys.map(k => (
                      <kbd key={k} className="bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-[9px] font-black text-indigo-300 min-w-[30px] text-center">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 pt-8 border-t border-white/5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <MousePointer2 className="w-5 h-5" />
              </div>
              <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500 leading-relaxed">
                Middle-click or Alt+Drag to move around the infinite workspace.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Toolbar;
