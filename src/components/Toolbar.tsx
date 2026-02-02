import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useModalStore } from './Modal';
import { LIMITS } from '../constants';
import { Plus, Layout, Zap, Download, Upload, SlidersHorizontal, ChevronLeft, ChevronRight, Trash2, Edit3, Camera } from 'lucide-react';
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
  const [isCapturing, setIsCapturing] = useState(false);

  const handleExport = () => {
    exportData();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importData(file);
    }
  };

  const handleScreenshot = async () => {
    const worldEl = document.getElementById('world');
    if (!worldEl || thoughts.length === 0) return;

    setIsCapturing(true);
    
    try {
      // Find the bounds of all thoughts in space coordinates
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      thoughts.forEach(t => {
        const el = document.querySelector(`.thought-bulb[data-id="${t.id}"]`) as HTMLElement;
        const width = 280;
        const height = el?.offsetHeight || 200;
        
        // Use the absolute positions from the store
        const x = t.x - 140; 
        const y = t.y - height / 2;
        
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + width > maxX) maxX = x + width;
        if (y + height > maxY) maxY = y + height;
      });

      // Add padding
      const padding = 100;
      minX -= padding;
      minY -= padding;
      maxX += padding;
      maxY += padding;

      const width = maxX - minX;
      const height = maxY - minY;

      const dataUrl = await toPng(worldEl, {
        backgroundColor: '#020408',
        style: {
          transform: `translate(${-minX}px, ${-minY}px) scale(1)`,
          position: 'absolute',
          width: `${width}px`,
          height: `${height}px`,
          margin: '0',
          padding: '0',
          left: '0',
          top: '0'
        },
        width: width,
        height: height,
        filter: (node: any) => {
          const isUI = node.classList?.contains('ui-layer') || 
                       node.id === 'connection-canvas' ||
                       node.tagName === 'BUTTON' && !node.closest('.thought-bulb');
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
            <button onClick={handleRenameSpace} className="p-2 hover:bg-white/5 rounded-xl text-slate-300"><Edit3 className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleMoveSpace(-1)} className="p-2 hover:bg-white/5 rounded-xl text-slate-300"><ChevronLeft className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleMoveSpace(1)} className="p-2 hover:bg-white/5 rounded-xl text-slate-300"><ChevronRight className="w-3.5 h-3.5" /></button>
            <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
            <button 
              onClick={handleDeleteSpace}
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
          <span className="text-white"><span>{thoughts.length}</span>/{LIMITS.MAX_THOUGHTS_PER_SPACE} Thoughts</span>
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
        <button 
          onClick={handleExport}
          className="hover:text-white flex items-center gap-2 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
        <button 
          onClick={handleScreenshot}
          disabled={isCapturing}
          className={cn(
            "hover:text-white flex items-center gap-2 transition-colors",
            isCapturing && "opacity-50 cursor-not-allowed"
          )}
        >
          <Camera className="w-3.5 h-3.5" /> {isCapturing ? 'Capturing...' : 'Screenshot'}
        </button>
        <label className="flex items-center gap-2 cursor-pointer hover:text-white">
          <Upload className="w-3.5 h-3.5" /> Import 
          <input 
            type="file" 
            className="hidden" 
            accept=".json" 
            onChange={handleImport}
          />
        </label>
        <div className="h-4 w-[1px] bg-white/10"></div>
        <button 
          onClick={handleCreateSpace}
          className="text-indigo-400 hover:text-white transition-all"
        >
          + New Space (<span>{spaces.length}</span>/{LIMITS.MAX_SPACES})
        </button>
      </div>
    </>
  );
};

export default Toolbar;