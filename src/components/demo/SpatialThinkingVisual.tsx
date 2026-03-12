import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, motionValue, animate } from 'framer-motion';
import { MousePointer2 } from 'lucide-react';
import DemoThought from './DemoThought';

const SPACES_DATA = [
  {
    name: 'University',
    cluster: ['ALGORITHMS', 'RENAISSANCE', 'QUANTUM'],
    free: ['AI_BASICS', 'ROME_MAP', 'ENERGY_LOG']
  },
  {
    name: 'Work',
    cluster: ['DASHBOARD', 'SYNC_CALL', 'MARKET_MAP'],
    free: ['API_DOCS', 'PLANNING', 'TRENDS']
  },
  {
    name: 'Bookmark',
    cluster: ['TECH_REVIEW', 'SCI_FI_BOOK', 'ACTION_MOVIE'],
    free: ['COOKING', 'BUSINESS', 'COMEDY']
  },
];

interface NodeState {
  id: string;
  title: string;
  type: 'cluster' | 'free';
  x: any; 
  y: any;
  vx: number;
  vy: number;
}

const SpatialThinkingVisual: React.FC = () => {
  const [activeSpaceIdx, setActiveSpaceIdx] = useState(0);
  const currentSpace = SPACES_DATA[activeSpaceIdx];
  const [isGrabbing, setIsGrabbing] = useState(false);
  
  const cursorX = useRef(motionValue(-300)).current;
  const cursorY = useRef(motionValue(-200)).current;
  const cursorScale = useRef(motionValue(1)).current;
  const cursorOpacity = useRef(motionValue(0)).current;
  
  const [nodes, setNodes] = useState<NodeState[]>([]);
  const grabTargetRef = useRef<string | null>(null);

  // Initialize nodes with fresh motionValues for fade-out support
  useEffect(() => {
    const newNodes: NodeState[] = [];
    
    currentSpace.cluster.forEach((title, i) => {
      newNodes.push({
        id: `cluster-${i}`,
        title,
        x: motionValue((i - 1) * 100),
        y: motionValue(i === 1 ? 80 : -60),
        vx: 0,
        vy: 0,
        type: 'cluster'
      });
    });

    currentSpace.free.forEach((title, i) => {
      newNodes.push({
        id: `free-${i}`,
        title,
        x: motionValue(i === 0 ? 240 : i === 1 ? -220 : 200),
        y: motionValue(i === 0 ? -270 : i === 1 ? 80 : -140),
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        type: 'free'
      });
    });

    setNodes(newNodes);
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
          if (n.type === 'cluster' && n.id !== grabTargetRef.current) {
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
              const strength = n.type === 'cluster' && other.type === 'cluster' ? 60 : 30;
              const force = strength / (distSq + 3000); // Softened
              ax += dx * force; ay += dy * force;
            }
          });

          // 5. Boundary drift for free nodes
          if (n.type === 'free') {
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
      cursorOpacity.set(0); cursorX.set(-300); cursorY.set(-200);
      grabTargetRef.current = null; setIsGrabbing(false);
      if (nodes.length === 0) return;
      await new Promise(r => setTimeout(r, 1000));
      if (!mounted) return;
      animations.push(animate(cursorOpacity, 1, { duration: 0.8 }));
      const lead = nodes.find(n => n.id === 'cluster-0');
      await Promise.all([
        animate(cursorX, lead?.x.get() || -100, { duration: 1.5, ease: "circOut" }),
        animate(cursorY, lead?.y.get() || -60, { duration: 1.5, ease: "circOut" })
      ]);
      if (!mounted) return;
      animations.push(animate(cursorScale, 1.2, { duration: 0.3, type: "spring" }));
      grabTargetRef.current = 'cluster-0'; setIsGrabbing(true);
      await new Promise(r => setTimeout(r, 400));
      await Promise.all([
        animate(cursorX, 150, { duration: 3, ease: "easeInOut" }),
        animate(cursorY, 40, { duration: 3, ease: "easeInOut" })
      ]);
      if (!mounted) return;
      await new Promise(r => setTimeout(r, 600));
      setIsGrabbing(false); grabTargetRef.current = null;
      animations.push(animate(cursorScale, 1, { duration: 0.4 }));
      await Promise.all([
        animate(cursorX, 400, { duration: 2, ease: "easeInOut" }),
        animate(cursorY, -300, { duration: 2, ease: "easeInOut" }),
        animate(cursorOpacity, 0, { duration: 1.5 })
      ]);
      if (!mounted) return;
      await new Promise(r => setTimeout(r, 800));
      setActiveSpaceIdx(prev => (prev + 1) % SPACES_DATA.length);
    };
    runAnimation();
    return () => { mounted = false; animations.forEach(a => a.stop && a.stop()); };
  }, [activeSpaceIdx, nodes.length, cursorX, cursorY, cursorOpacity, cursorScale]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-transparent pointer-events-none">
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-1.5 p-1.5 glass rounded-2xl border border-white/5 max-w-[90vw] pointer-events-auto">
        {SPACES_DATA.map((space, idx) => (
          <button key={space.name} onClick={() => setActiveSpaceIdx(idx)} className={`px-2 py-1 md:px-4 md:py-1.5 rounded-xl text-[7px] md:text-[8px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] transition-all duration-300 ${activeSpaceIdx === idx ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>{space.name}</button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={activeSpaceIdx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.5 } }} transition={{ duration: 0.5 }} className="absolute inset-0">
          <svg viewBox="-300 -300 600 600" className="absolute inset-0 w-full h-full overflow-visible">
            {[ [0, 1], [1, 2], [2, 0] ].map(([i, j]) => {
              const nodeA = nodes.find(n => n.id === `cluster-${i}`);
              const nodeB = nodes.find(n => n.id === `cluster-${j}`);
              if (!nodeA || !nodeB) return null;
              return <motion.line key={`${i}-${j}`} x1={nodeA.x} y1={nodeA.y} x2={nodeB.x} y2={nodeB.y} stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray="6 12" strokeOpacity="0.35" />;
            })}
          </svg>
          {nodes.map((node) => (
            <motion.div key={node.id} className="absolute left-1/2 top-1/2" style={{ x: node.x, y: node.y, zIndex: node.type === 'cluster' ? 20 : 10 }}>
              <div className="-translate-x-1/2 -translate-y-1/2"><DemoThought title={node.title} className={node.type === 'free' ? 'scale-90 opacity-40' : 'shadow-2xl'} /></div>
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
