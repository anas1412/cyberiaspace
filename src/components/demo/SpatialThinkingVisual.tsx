import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, motionValue, animate } from 'framer-motion';
import { MousePointer2, ChevronDown } from 'lucide-react';
import DemoThought from './DemoThought';

const SPACES_DATA = [
  {
    name: 'University',
    cluster: [
      { title: 'ALGORITHMS', type: 'text' as const }, 
      { title: 'RENAISSANCE', type: 'image' as const }, 
      { title: 'QUANTUM', type: 'doc' as const }
    ],
    free: [
      { title: 'AI_BASICS', type: 'doc' as const }, 
      { title: 'ROME_MAP', type: 'image' as const }, 
      { title: 'ENERGY_LOG', type: 'text' as const }
    ]
  },
  {
    name: 'Work',
    cluster: [
      { title: 'DASHBOARD', type: 'table' as const }, 
      { title: 'SYNC_CALL', type: 'text' as const }, 
      { title: 'MARKET_MAP', type: 'image' as const },
      { title: 'Q4_STRATEGY', type: 'doc' as const },
      { title: 'API_REF', type: 'file' as const }
    ],
    free: [
      { title: 'PLANNING', type: 'text' as const }, 
      { title: 'TRENDS', type: 'table' as const },
      { title: 'ASSETS', type: 'image' as const }
    ]
  },
  {
    name: 'Bookmark',
    cluster: [
      { title: 'TECH_REVIEW', type: 'image' as const }, 
      { title: 'SCI_FI_BOOK', type: 'doc' as const }, 
      { title: 'ACTION_MOVIE', type: 'image' as const },
      { title: 'RECIPES', type: 'text' as const },
      { title: 'TRAVEL_LOG', type: 'doc' as const },
      { title: 'FITNESS', type: 'table' as const },
      { title: 'DESIGN_INSPO', type: 'image' as const },
      { title: 'CODING_TIPS', type: 'text' as const }
    ],
    free: [
      { title: 'COOKING', type: 'image' as const }, 
      { title: 'BUSINESS', type: 'text' as const }, 
      { title: 'COMEDY', type: 'text' as const },
      { title: 'MUSIC', type: 'image' as const }
    ]
  },
];

interface NodeState {
  id: string;
  title: string;
  type: 'text' | 'image' | 'file' | 'doc' | 'table';
  nodeType: 'cluster' | 'free';
  x: any; 
  y: any;
  vx: number;
  vy: number;
}

const SpatialThinkingVisual: React.FC = () => {
  const [activeSpaceIdx, setActiveSpaceIdx] = useState(0);
  const currentSpace = SPACES_DATA[activeSpaceIdx];
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [isSpaceMenuOpen, setIsSpaceMenuOpen] = useState(false);
  const spaceMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (spaceMenuRef.current && !spaceMenuRef.current.contains(e.target as Node)) {
        setIsSpaceMenuOpen(false);
      }
    };
    if (isSpaceMenuOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isSpaceMenuOpen]);
  
  const cursorX = useRef(motionValue(-300)).current;
  const cursorY = useRef(motionValue(-200)).current;
  const cursorScale = useRef(motionValue(1)).current;
  const cursorOpacity = useRef(motionValue(0)).current;
  
  const [nodes, setNodes] = useState<NodeState[]>([]);
  const grabTargetRef = useRef<string | null>(null);

  // Initialize nodes with fresh motionValues for fade-out support
  useEffect(() => {
    setNodes([]); // Clear nodes immediately to trigger reset in animation sequence
    
    // Tiny delay to ensure state clears before rebuilding
    const timer = setTimeout(() => {
      const newNodes: NodeState[] = [];
      
    currentSpace.cluster.forEach((thought, i) => {
      // Circular layout for cluster nodes
      const angle = (i / currentSpace.cluster.length) * Math.PI * 2;
      const radius = 120;
      newNodes.push({
        id: `cluster-${i}`,
        title: thought.title,
        type: thought.type,
        x: motionValue(Math.cos(angle) * radius),
        y: motionValue(Math.sin(angle) * radius),
        vx: 0,
        vy: 0,
        nodeType: 'cluster'
      });
    });

    currentSpace.free.forEach((thought, i) => {
      // Spread free nodes out
      const angles = [0.5, 2.5, 4.5, 5.5];
      const angle = angles[i % angles.length] || Math.random() * Math.PI * 2;
      const radius = 240 + (Math.random() * 40);
      newNodes.push({
        id: `free-${i}`,
        title: thought.title,
        type: thought.type,
        x: motionValue(Math.cos(angle) * radius),
        y: motionValue(Math.sin(angle) * radius),
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        nodeType: 'free'
      });
    });

      setNodes(newNodes);
    }, 10);

    return () => clearTimeout(timer);
  }, [activeSpaceIdx]);

  // Physics Loop (Slow, Smooth, No Jitter)
  useEffect(() => {
    let raf: number;
    let time = 0;
    const loop = () => {
      time += 0.016;
      if (nodes.length > 0) {
        nodes.forEach((n, i) => {
          let ax = 0; let ay = 0;
          const nx = n.x.get(); const ny = n.y.get();

          // 1. Attraction to cursor (if grabbed)
          if (n.id === grabTargetRef.current) {
            ax += (cursorX.get() - nx) * 0.1;
            ay += (cursorY.get() - ny) * 0.1;
          }

          // 2. Gravity to center (cluster nodes only)
          if (n.nodeType === 'cluster' && n.id !== grabTargetRef.current) {
            ax += (0 - nx) * 0.003;
            ay += (0 - ny) * 0.003;
          }

          // 3. Subtle Drift
          ax += Math.sin(time * 0.4 + i) * 0.008;
          ay += Math.cos(time * 0.3 + i) * 0.008;

          // 4. Repulsion (Softened)
          nodes.forEach((other, j) => {
            if (i === j) return;
            const ox = other.x.get(); const oy = other.y.get();
            const dx = nx - ox; const dy = ny - oy;
            const distSq = dx * dx + dy * dy || 1;
            if (distSq < 50000) {
              const strength = n.nodeType === 'cluster' && other.nodeType === 'cluster' ? 60 : 30;
              const force = strength / (distSq + 3000); // Softened
              ax += dx * force; ay += dy * force;
            }
          });

          // 5. Boundary drift for free nodes
          if (n.nodeType === 'free') {
            if (Math.abs(nx) > 300) ax -= nx * 0.0005;
            if (Math.abs(ny) > 300) ay -= ny * 0.0005;
          }

          n.vx = (n.vx + ax) * 0.95; // High damping
          n.vy = (n.vy + ay) * 0.95;
          n.x.set(nx + n.vx);
          n.y.set(ny + n.vy);
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [nodes, cursorX, cursorY]);

  // Animation Sequence
  useEffect(() => {
    let mounted = true;
    const animations: any[] = [];
    
    const runAnimation = async () => {
      // 1. Reset Position and State
      grabTargetRef.current = null; 
      setIsGrabbing(false);
      cursorOpacity.set(0); 
      cursorX.set(-300); 
      cursorY.set(-200);
      cursorScale.set(1);
      
      // Wait for nodes to be cleared and re-initialized for the NEW space
      // This ensures we don't start the animation using old node positions
      if (nodes.length === 0 || nodes[0].title !== currentSpace.cluster[0].title) {
        await new Promise(r => setTimeout(r, 50));
        if (mounted) runAnimation();
        return;
      }

      await new Promise(r => setTimeout(r, 800));
      if (!mounted) return;

      // 2. Fade in Cursor
      animations.push(animate(cursorOpacity, 1, { duration: 0.8 }));
      
      // 3. Move to target node
      const lead = nodes.find(n => n.id === 'cluster-0');
      if (lead) {
        await Promise.all([
          animate(cursorX, lead.x.get(), { duration: 1.5, ease: "circOut" }),
          animate(cursorY, lead.y.get(), { duration: 1.5, ease: "circOut" })
        ]);
      }

      if (!mounted) return;

      // 4. Grab
      animations.push(animate(cursorScale, 1.2, { duration: 0.3, type: "spring" }));
      grabTargetRef.current = 'cluster-0'; 
      setIsGrabbing(true);
      
      const startX = lead?.x.get() || 0;
      const startY = lead?.y.get() || 0;
      
      await new Promise(r => setTimeout(r, 400));
      
      // 5. Smooth Drag
      await Promise.all([
        animate(cursorX, startX + 160, { duration: 2.5, ease: "easeInOut" }),
        animate(cursorY, startY + 60, { duration: 2.5, ease: "easeInOut" })
      ]);

      if (!mounted) return;
      await new Promise(r => setTimeout(r, 800));

      // 6. Release
      setIsGrabbing(false); 
      grabTargetRef.current = null;
      animations.push(animate(cursorScale, 1, { duration: 0.4 }));

      // 7. Exit Cursor
      await Promise.all([
        animate(cursorX, 400, { duration: 1.5, ease: "easeIn" }),
        animate(cursorY, -300, { duration: 1.5, ease: "easeIn" }),
        animate(cursorOpacity, 0, { duration: 1.2 })
      ]);

      if (!mounted) return;
      await new Promise(r => setTimeout(r, 1000));
      
      // 8. Switch Space
      setActiveSpaceIdx(prev => (prev + 1) % SPACES_DATA.length);
    };

    runAnimation();
    return () => { 
      mounted = false; 
      animations.forEach(a => a.stop && a.stop()); 
    };
  }, [activeSpaceIdx, nodes.length === 0]); // Depend on nodes length being zero to catch initial load

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-transparent pointer-events-none">
      <div className="absolute top-8 left-8 z-[110] pointer-events-auto" ref={spaceMenuRef}>
        <div className="relative">
          <button 
            onClick={() => setIsSpaceMenuOpen(!isSpaceMenuOpen)}
            className={`flex items-center gap-3 px-4 h-[44px] glass rounded-2xl border border-white/5 transition-all shadow-2xl ${isSpaceMenuOpen ? 'bg-white/10 text-white' : 'text-white/80 hover:text-white'}`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{currentSpace.name}</span>
            <ChevronDown className={`w-3.5 h-3.5 opacity-50 transition-transform duration-300 ${isSpaceMenuOpen ? 'rotate-180 opacity-100' : ''}`} />
          </button>
          
          <AnimatePresence>
            {isSpaceMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full mt-2 left-0 w-48 overflow-hidden z-50"
                style={{
                  background: 'rgba(10,12,24,0.96)',
                  border: '1px solid rgba(100,170,255,0.25)',
                  borderRadius: 12,
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}
              >
                <div
                  className="text-[9px] font-bold tracking-[0.3em] uppercase px-4 py-2"
                  style={{ color: 'rgba(255,255,255,0.2)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                >
                  Spaces
                </div>
                {SPACES_DATA.map((space, idx) => (
                  <button 
                    key={space.name} 
                    onClick={() => { setActiveSpaceIdx(idx); setIsSpaceMenuOpen(false); }}
                    className={`w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors ${activeSpaceIdx === idx ? 'bg-[rgba(100,170,255,0.14)] text-white' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                  >
                    {space.name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={activeSpaceIdx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.5 } }} transition={{ duration: 0.5 }} className="absolute inset-0">
          <svg viewBox="-300 -300 600 600" className="absolute inset-0 w-full h-full overflow-visible">
            {currentSpace.cluster.map((_, i) => {
              const nodeA = nodes.find(n => n.id === `cluster-${i}`);
              // Connect to next node in circle
              const nodeB = nodes.find(n => n.id === `cluster-${(i + 1) % currentSpace.cluster.length}`);
              
              if (!nodeA || !nodeB) return null;
              
              return (
                <React.Fragment key={`line-${i}`}>
                  <motion.line 
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    x1={nodeA.x} y1={nodeA.y} x2={nodeB.x} y2={nodeB.y} 
                    stroke="rgba(126,207,255,0.45)" 
                    strokeWidth="1" 
                    strokeDasharray="4 4" 
                    transition={{ pathLength: { duration: 1.5, ease: "easeInOut" } }}
                  />
                  {/* Add some cross-links for larger clusters */}
                  {currentSpace.cluster.length > 4 && i % 2 === 0 && (() => {
                    const nodeC = nodes.find(n => n.id === `cluster-${(i + 2) % currentSpace.cluster.length}`);
                    if (!nodeC) return null;
                    return (
                      <motion.line 
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 0.6 }}
                        x1={nodeA.x} y1={nodeA.y} x2={nodeC.x} y2={nodeC.y} 
                        stroke="rgba(126,207,255,0.25)" 
                        strokeWidth="0.8" 
                        strokeDasharray="2 6" 
                        transition={{ pathLength: { duration: 2, ease: "easeInOut" }, delay: 0.5 }}
                      />
                    );
                  })()}
                </React.Fragment>
              );
            })}
          </svg>
          {nodes.map((node) => (
            <motion.div key={node.id} className="absolute left-1/2 top-1/2" style={{ x: node.x, y: node.y, zIndex: node.nodeType === 'cluster' ? 20 : 10 }}>
              <div className="-translate-x-1/2 -translate-y-1/2">
                <DemoThought title={node.title} type={node.type} className={node.nodeType === 'free' ? 'scale-90 opacity-40' : 'shadow-2xl'} />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
      <motion.div className="absolute left-1/2 top-1/2 z-[100] pointer-events-none" style={{ x: cursorX, y: cursorY, scale: cursorScale, opacity: cursorOpacity }}>
        <div className="relative">
          <MousePointer2 className="w-6 h-6 text-white fill-white/20 -translate-x-1 translate-y-1 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
          {isGrabbing && <motion.div className="absolute inset-0 w-6 h-6 bg-white/40 rounded-full blur-xl" animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.2, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} />}
        </div>
      </motion.div>
    </div>
  );
};

export default SpatialThinkingVisual;
