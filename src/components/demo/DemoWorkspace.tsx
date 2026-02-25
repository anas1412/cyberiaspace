import React, { useEffect, Suspense, lazy } from 'react';
import { useStore } from '../../store/useStore';
import { MousePointer2, Zap, Rocket } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Import real components
const Viewport = lazy(() => import('../Viewport'));

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DemoWorkspace: React.FC = () => {
  const setDemoMode = useStore((state) => state.setDemoMode);
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);
  const activeSpace = spaces.find(s => s.id === activeSpaceId);
  const updateSpace = useStore((state) => state.updateSpace);
  const isDemo = useStore((state) => state.isDemo);

  useEffect(() => {
    // Initialize demo mode on mount
    setDemoMode(true);
    
    return () => {
      // Clean up demo mode on unmount
      setDemoMode(false);
    };
  }, [setDemoMode]);

  const physicsEnabled = activeSpace?.physics ?? true;

  if (!isDemo) return null;

  return (
    <div 
      id="demo-workspace-container"
      data-demo-workspace="true"
      className="w-full h-[600px] glass rounded-[3rem] overflow-hidden relative border border-white/5 shadow-2xl group pointer-events-auto"
    >
      {/* Background */}
      {/*<div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
          style={{ backgroundImage: 'url(/background.jpg)' }}
        />*/}
      {/* Real App Layers */}
      <Suspense fallback={null}>
        <Viewport />
      </Suspense>
      
      {/* Fixed Spatial Indicator */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] flex p-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl transition-all group-hover:opacity-100 opacity-80 pointer-events-none">
        <div className="px-4 py-2.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white shadow-lg">
          <MousePointer2 className="w-4 h-4" />
          <span>Spatial Mode</span>
        </div>
      </div>

      {/* Physics Toggle */}
      <div className="absolute top-6 right-6 z-[100] transition-all group-hover:opacity-100 opacity-60 pointer-events-auto">
        <button 
          onClick={() => activeSpaceId && updateSpace(activeSpaceId, { physics: !physicsEnabled })}
          className={cn(
            "p-3 rounded-2xl border transition-all flex items-center gap-2",
            physicsEnabled 
              ? "bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]" 
              : "bg-white/5 border-white/10 text-slate-500"
          )}
          title="Toggle Physics Engine"
        >
          <Zap className={cn("w-4 h-4", physicsEnabled && "fill-current")} />
        </button>
      </div>

      <div className="absolute bottom-6 left-6 z-[100] flex items-center gap-3 transition-all group-hover:opacity-100 opacity-40">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
          <Rocket className="w-4 h-4 animate-pulse" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-white">Live Engine Demo</span>
          <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Read-Only Experience</span>
        </div>
      </div>

      {/* Interactive Hint */}
      <div className="absolute bottom-6 right-6 z-[100] pointer-events-none transition-all group-hover:opacity-0 opacity-100">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500/60 animate-pulse">Drag Nodes to Interact</span>
      </div>
    </div>
  );
};

export default DemoWorkspace;
