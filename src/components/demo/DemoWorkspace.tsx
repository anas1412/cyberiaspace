import React, { useEffect, Suspense, lazy, useState } from 'react';
import { useStore } from '../../store/useStore';
import { MousePointer2, Zap, Rocket } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [isInteracting, setIsInteracting] = useState(false);
  const setTransform = useStore((state) => state.setTransform);

  useEffect(() => {
    setDemoMode(true);
    // Set a locked zoomed-out state for the demo
    const initialScale = window.innerWidth < 768 ? 0.5 : 0.7;
    setTransform({ x: 0, y: 0, scale: initialScale });
    
    return () => setDemoMode(false);
  }, [setDemoMode, setTransform]);

  const physicsEnabled = activeSpace?.physics ?? true;

  if (!isDemo) return null;

  return (
    <div 
      id="demo-workspace-container"
      data-demo-workspace="true"
      className="w-full h-[400px] md:h-[600px] glass rounded-[2rem] md:rounded-[3rem] overflow-hidden relative border border-white/5 shadow-2xl group pointer-events-auto"
    >
      {/* Real App Layers */}
      <div className={cn("w-full h-full", !isInteracting && "md:pointer-events-auto pointer-events-none")}>
        <Suspense fallback={null}>
          <Viewport isInteracting={isInteracting} />
        </Suspense>
      </div>


      <AnimatePresence>
        {!isInteracting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onPointerDown={(e) => { e.stopPropagation(); setIsInteracting(true); }}
            className="absolute inset-0 z-[150] md:hidden bg-black/40 backdrop-blur-[2px] flex items-center justify-center cursor-pointer group/shield pointer-events-auto"
          >

            <div className="px-6 py-3 rounded-full glass border border-white/20 flex items-center gap-3 shadow-2xl group-active/shield:scale-95 transition-transform">
              <MousePointer2 className="w-5 h-5 text-[var(--accent)]" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-white">Tap to Explore</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Fixed Spatial Indicator */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] flex p-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl transition-all group-hover:opacity-100 opacity-80 pointer-events-none">
        <div className="md:px-4 md:py-2.5 px-2 py-1.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
          <MousePointer2 className="w-4 h-4" />
          <span>Spatial Mode</span>
        </div>
      </div>

      {/* Physics Toggle */}
      <div className="absolute top-6 right-6 z-[100] transition-all group-hover:opacity-100 opacity-60 pointer-events-auto">
        <button 
          onClick={() => activeSpaceId && updateSpace(activeSpaceId, { physics: !physicsEnabled })}
          className={cn(
            "md:p-3 p-2 rounded-2xl border transition-all flex items-center gap-2",
            physicsEnabled 
              ? "bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]" 
              : "bg-white/5 border-white/10 text-slate-500"
          )}
          title="Toggle Physics Engine"
        >
          <Zap className={cn("w-4 h-4", physicsEnabled && "fill-current")} />
        </button>
      </div>

      <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 z-[100] flex items-center gap-3 transition-all group-hover:opacity-100 opacity-40">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(99, 102, 241, 0.2)' }}>
          <Rocket className="w-4 h-4" style={{ color: 'var(--accent-secondary)' }} />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest text-white">Live Engine Demo</span>
          <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Read-Only Experience</span>
        </div>
      </div>

      {/* Interactive Hint */}
      <div className="absolute bottom-6 right-6 z-[100] pointer-events-none transition-all group-hover:opacity-0 opacity-100 hidden md:block">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse" style={{ color: 'var(--accent)', opacity: 0.6 }}>Drag Nodes to Interact</span>
      </div>

    </div>
  );
};

export default DemoWorkspace;
