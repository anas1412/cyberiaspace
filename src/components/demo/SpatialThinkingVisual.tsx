import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, motionValue } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import DemoThought from './DemoThought';

const SPACES_DATA = [
  {
    name: 'University',
    cluster: [
      { title: 'ALGORITHMS', type: 'text' as const }, 
      { title: 'RENAISSANCE', type: 'image' as const }, 
      { title: 'QUANTUM', type: 'doc' as const }
    ],
    clusterColor: '#6366f1',
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
    clusterColor: '#8b5cf6',
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
    clusterColor: '#06b6d4',
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
  phase: number; // Per-node phase offset for organic drift
}

const SpatialThinkingVisual: React.FC = () => {
  const [activeSpaceIdx, setActiveSpaceIdx] = useState(0);
  const currentSpace = SPACES_DATA[activeSpaceIdx];
  const [isSpaceMenuOpen, setIsSpaceMenuOpen] = useState(false);
  const spaceMenuRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<NodeState[]>([]);
  const centroidX = useRef(motionValue(0)).current;
  const centroidY = useRef(motionValue(0)).current;

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

  // Auto-rotate spaces
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSpaceIdx(prev => (prev + 1) % SPACES_DATA.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

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
        phase: Math.random() * Math.PI * 2,
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
        vx: 0,
        vy: 0,
        phase: Math.random() * Math.PI * 2,
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

          // 1. Gravity to center (cluster nodes only) — very gentle
          if (n.nodeType === 'cluster') {
            ax += (0 - nx) * 0.001;
            ay += (0 - ny) * 0.001;
          }

          // 2. Organic drift — per-node phase, slower frequencies
          ax += Math.sin(time * 0.25 + n.phase) * 0.004;
          ay += Math.cos(time * 0.2 + n.phase * 1.3) * 0.004;

          // 3. Repulsion — much softer, wider radius
          nodes.forEach((other, j) => {
            if (i === j) return;
            const ox = other.x.get(); const oy = other.y.get();
            const dx = nx - ox; const dy = ny - oy;
            const distSq = dx * dx + dy * dy || 1;
            if (distSq < 80000) {
              const strength = n.nodeType === 'cluster' && other.nodeType === 'cluster' ? 40 : 20;
              const force = strength / (distSq + 5000);
              ax += dx * force; ay += dy * force;
            }
          });

          // 4. Boundary drift for free nodes — very soft
          if (n.nodeType === 'free') {
            if (Math.abs(nx) > 280) ax -= nx * 0.0002;
            if (Math.abs(ny) > 280) ay -= ny * 0.0002;
          }

          n.vx = (n.vx + ax) * 0.96;
          n.vy = (n.vy + ay) * 0.96;
          n.x.set(nx + n.vx);
          n.y.set(ny + n.vy);
        });

        // Update centroid for star/hub connections
        const clusterNodes = nodes.filter(n => n.nodeType === 'cluster');
        if (clusterNodes.length >= 2) {
          let cx = 0, cy = 0;
          clusterNodes.forEach(n => { cx += n.x.get(); cy += n.y.get(); });
          centroidX.set(cx / clusterNodes.length);
          centroidY.set(cy / clusterNodes.length);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [nodes]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-transparent pointer-events-none">
      <div className="absolute top-8 left-8 z-[110] pointer-events-auto" ref={spaceMenuRef}>
        <div className="relative">
          <button 
            onClick={() => setIsSpaceMenuOpen(!isSpaceMenuOpen)}
            className={`flex items-center gap-3 px-4 h-[44px] glass rounded-2xl border border-[var(--glass-border)] transition-all shadow-2xl ${isSpaceMenuOpen ? 'bg-[var(--glass-bg)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            <span className="text-[10px] font-semibold tracking-[0.2em]">{currentSpace.name}</span>
            <ChevronDown className={`w-3.5 h-3.5 opacity-50 transition-transform duration-300 ${isSpaceMenuOpen ? 'rotate-180 opacity-100' : ''}`} />
          </button>
          
          <AnimatePresence>
            {isSpaceMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full mt-2 left-0 w-48 overflow-hidden z-50 glass rounded-xl border border-[var(--glass-border)]"
                style={{
                  boxShadow: '0 8px 32px var(--glass-border)',
                }}
              >
                <div
                  className="text-[9px] font-bold tracking-[0.3em] uppercase px-4 py-2 text-[var(--text-muted)] border-b border-[var(--glass-border)]"
                >
                  Spaces
                </div>
                {SPACES_DATA.map((space, idx) => (
                  <button 
                    key={space.name} 
                    onClick={() => { setActiveSpaceIdx(idx); setIsSpaceMenuOpen(false); }}
                    className={`w-full px-4 py-3 text-left text-[10px] font-semibold tracking-widest transition-colors ${activeSpaceIdx === idx ? 'bg-[var(--accent)]/20 text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]'}`}
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
            {/* Star/Hub topology: each member → geometric centroid */}
            {currentSpace.cluster.map((_, i) => {
              const node = nodes.find(n => n.id === `cluster-${i}`);
              if (!node) return null;
              return (
                <motion.line
                  key={`hub-${i}`}
                  x1={node.x}
                  y1={node.y}
                  x2={centroidX}
                  y2={centroidY}
                  stroke={currentSpace.clusterColor}
                  strokeWidth="1"
                  opacity="0.5"
                  style={{
                    filter: `drop-shadow(0 0 6px ${currentSpace.clusterColor}80)`,
                  }}
                />
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
    </div>
  );
};

export default SpatialThinkingVisual;
