import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, motionValue, animate } from 'framer-motion';
import { Zap, Orbit, Columns3, CalendarDays, ChevronDown } from 'lucide-react';
import DemoThought from './DemoThought';

type ViewMode = 'spatial' | 'kanban' | 'calendar';

const SPACES = [
  {
    id: 'uni',
    name: 'University',
    stacks: [
      { id: 's1', name: 'COMP_SCI', color: '#6366f1', thoughts: [{title:'ALGORITHMS', type: 'text'}, {title:'AI_BASICS', type: 'doc'}, {title:'DATABASE', type: 'table'}] },
      { id: 's2', name: 'HISTORY', color: '#8b5cf6', thoughts: [{title:'RENAISSANCE', type: 'image'}, {title:'ANCIENT_ROME', type: 'doc'}, {title:'WORLD_WARS', type: 'text'}] },
      { id: 's3', name: 'PHYSICS', color: '#3b82f6', thoughts: [{title:'QUANTUM', type: 'text'}, {title:'RELATIVITY', type: 'file'}, {title:'ENERGY', type: 'text'}] }
    ]
  },
  {
    id: 'wrk',
    name: 'Work',
    stacks: [
      { id: 's4', name: 'PROJECT_X', color: '#ec4899', thoughts: [{title:'DASHBOARD', type: 'table'}, {title:'API_DOCS', type: 'doc'}, {title:'AUTH_FLOW', type: 'text'}] },
      { id: 's5', name: 'MEETINGS', color: '#f43f5e', thoughts: [{title:'SYNC_CALL', type: 'text'}, {title:'PLANNING', type: 'doc'}, {title:'REVIEW', type: 'image'}] },
      { id: 's6', name: 'RESEARCH', color: '#d946ef', thoughts: [{title:'MARKET_MAP', type: 'image'}, {title:'TRENDS', type: 'table'}, {title:'CLIENT_LOG', type: 'file'}] }
    ]
  },
  {
    id: 'bmk',
    name: 'Bookmark',
    stacks: [
      { id: 's7', name: 'VIDEOS', color: '#10b981', thoughts: [{title:'TECH_REVIEW', type: 'image'}, {title:'COOKING', type: 'image'}, {title:'TRAVEL_VLOG', type: 'image'}] },
      { id: 's8', name: 'BOOKS', color: '#06b6d4', thoughts: [{title:'SCI_FI', type: 'doc'}, {title:'BIOGRAPHY', type: 'text'}, {title:'BUSINESS', type: 'file'}] },
      { id: 's9', name: 'MOVIES', color: '#84cc16', thoughts: [{title:'ACTION', type: 'text'}, {title:'DRAMA', type: 'text'}, {title:'COMEDY', type: 'text'}] }
    ]
  }
];

interface ThoughtPos {
  id: string;
  x: any; 
  y: any;
  vx: number;
  vy: number;
}

// Layout Constants
const KANBAN_COLS = [-330, -110, 110, 330];
const CAL_COL_W = 150;
const CAL_ROW_H = 85;

const InteractiveDemo: React.FC = () => {
  const [activeSpaceIdx, setActiveSpaceIdx] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('spatial');
  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSpaceMenuOpen, setIsSpaceMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
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
  
  const [nodes, setNodes] = useState<ThoughtPos[]>([]);
  const dragTargetRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const mouseRef = useRef({ x: 0, y: 0 });

  const activeSpace = SPACES[activeSpaceIdx];

  // Initialize positions
  useEffect(() => {
    const newNodes: ThoughtPos[] = [];
    activeSpace.stacks.forEach((stack, sIdx) => {
      stack.thoughts.forEach((_, tIdx) => {
        const id = `${stack.id}-${tIdx}`;
        // Start near spatial clusters
        const x = motionValue((sIdx - 1) * 250 + (Math.random() - 0.5) * 50);
        const y = motionValue((tIdx - 1) * 120 + (Math.random() - 0.5) * 50);
        newNodes.push({ id, x, y, vx: 0, vy: 0 });
      });
    });
    setNodes(newNodes);
  }, [activeSpaceIdx]);

  useEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => setIsTransitioning(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning]);

  // Layout Transition Engine
  useEffect(() => {
    if (viewMode !== 'spatial' && nodes.length > 0) {
      nodes.forEach((n, i) => {
        let tx = 0; let ty = 0;
        if (viewMode === 'kanban') {
          let colIdx = 0; let rowIdx = 0;
          if (i < 2) { colIdx = 0; rowIdx = i; }
          else if (i < 4) { colIdx = 1; rowIdx = i - 2; }
          else if (i < 7) { colIdx = 2; rowIdx = i - 4; }
          else { colIdx = 3; rowIdx = i - 7; }
          tx = KANBAN_COLS[colIdx]; 
          ty = -100 + rowIdx * 110;
        } else if (viewMode === 'calendar') {
          // Spread thoughts across the month
          const days = [3, 6, 10, 13, 17, 20, 24, 27, 30];
          const day = days[i];
          const col = (day - 1) % 7;
          const row = Math.floor((day - 1) / 7);
          tx = (col - 3) * CAL_COL_W; 
          ty = (row - 2) * CAL_ROW_H;
        }
        animate(n.x, tx, { type: 'spring', damping: 25, stiffness: 120, delay: i * 0.02 });
        animate(n.y, ty, { type: 'spring', damping: 25, stiffness: 120, delay: i * 0.02 });
      });
    }
  }, [viewMode, nodes]);

  // Physics Loop
  useEffect(() => {
    let raf: number;
    let time = 0;
    const loop = () => {
      time += 0.016;
      if ((viewMode === 'spatial' && physicsEnabled) || dragTargetRef.current) {
        nodes.forEach(n => {
          if (n.id === dragTargetRef.current) {
            n.x.set(mouseRef.current.x - dragOffsetRef.current.x);
            n.y.set(mouseRef.current.y - dragOffsetRef.current.y);
            n.vx = 0; n.vy = 0; return;
          }
          if (viewMode === 'spatial' && physicsEnabled) {
            let ax = 0; let ay = 0;
            const nx = n.x.get(); const ny = n.y.get();
            const [stackId] = n.id.split('-');
            const stack = activeSpace.stacks.find(s => s.id === stackId);
            if (!stack) return;
            const stackIdx = activeSpace.stacks.indexOf(stack);
            ax += ((stackIdx - 1) * 250 - nx) * 0.002;
            ay += (0 - ny) * 0.002;
            const driftIdx = nodes.indexOf(n);
            ax += Math.sin(time * 0.5 + driftIdx) * 0.005;
            ay += Math.cos(time * 0.4 + driftIdx) * 0.005;
            nodes.forEach(other => {
              if (n.id === other.id) return;
              const dx = nx - other.x.get(); const dy = ny - other.y.get();
              const distSq = dx * dx + dy * dy || 1;
              if (distSq < 50000) {
                const force = 40 / (distSq + 2000); 
                ax += dx * force; ay += dy * force;
              }
            });
            n.vx = (n.vx + ax) * 0.96; 
            n.vy = (n.vy + ay) * 0.96;
            n.x.set(nx + n.vx); n.y.set(ny + n.vy);
          }
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [physicsEnabled, nodes, activeSpace.stacks, viewMode]);

  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
    return null;
  }

  return (
    <div ref={containerRef} onPointerMove={(e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current = { x: (e.clientX - rect.left) - rect.width / 2, y: (e.clientY - rect.top) - rect.height / 2 };
    }} onPointerUp={() => { dragTargetRef.current = null; }} className="w-full h-[400px] md:h-[600px] glass rounded-2xl overflow-hidden relative border border-[var(--glass-border)] shadow-2xl group pointer-events-auto bg-[var(--bg-page)]/20">
      
      {/* Unified Switcher Header */}
      <div className="absolute top-8 left-0 right-0 z-[110] flex items-center justify-between pointer-events-none px-8">
        <div className="flex-1 invisible lg:visible" /> {/* Placeholder for logo alignment metaphor */}

        {/* Center: View Modes */}
        <div className="flex items-center gap-1.5 p-1.5 glass rounded-2xl border border-[var(--glass-border)] pointer-events-auto shadow-2xl">
          {[
            { id: 'spatial', icon: Orbit, label: 'Spatial' },
            { id: 'kanban', icon: Columns3, label: 'Kanban' },
            { id: 'calendar', icon: CalendarDays, label: 'Calendar' }
          ].map((mode) => {
            const isActive = viewMode === mode.id;
            const Icon = mode.icon;
            return (
              <button 
                key={mode.id}
                onClick={() => setViewMode(mode.id as ViewMode)} 
                className={`px-3 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 ${isActive ? 'bg-[var(--text-primary)] text-[var(--bg-page)] shadow-lg' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]'}`} 
                title={`${mode.label} View`}
              >
                <Icon className="w-4 h-4" />
                <span className={`text-[9px] font-semibold tracking-widest transition-all overflow-hidden whitespace-nowrap ${isActive ? 'max-w-[60px] opacity-100' : 'max-w-0 opacity-0'}`}>
                  {mode.id}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Side: Space Switcher (Click dropdown) */}
        <div className="flex-1 flex justify-end">
          <div className="relative pointer-events-auto" ref={spaceMenuRef}>
            <button 
              onClick={() => setIsSpaceMenuOpen(!isSpaceMenuOpen)}
              className={`flex items-center gap-3 px-4 h-[44px] glass rounded-2xl border border-[var(--glass-border)] transition-all shadow-2xl ${isSpaceMenuOpen ? 'bg-[var(--glass-bg)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              <span className="text-[10px] font-semibold tracking-[0.2em]">{activeSpace.name}</span>
              <ChevronDown className={`w-3.5 h-3.5 opacity-50 transition-transform duration-300 ${isSpaceMenuOpen ? 'rotate-180 opacity-100' : ''}`} />
            </button>
            
            <AnimatePresence>
              {isSpaceMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  className="absolute top-full mt-2 right-0 w-48 glass rounded-2xl border border-[var(--glass-border)] shadow-2xl overflow-hidden z-50 py-1"
                >
                  {SPACES.map((space, idx) => (
                    <button 
                      key={space.id} 
                      onClick={() => { 
                        if (activeSpaceIdx !== idx) { setIsTransitioning(true); setActiveSpaceIdx(idx); }
                        setIsSpaceMenuOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-[9px] font-semibold tracking-widest flex items-center gap-3 transition-colors ${activeSpaceIdx === idx ? 'bg-[var(--glass-bg)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${activeSpaceIdx === idx ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-slate-700'}`} />
                      {space.name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Kanban Background */}
      <AnimatePresence>
        {viewMode === 'kanban' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-full max-w-5xl h-full">
              {['UNPLANNED', 'TODO', 'DOING', 'DONE'].map((label, i) => {
                const tx = KANBAN_COLS[i];
                return (
                  <div key={label} className="absolute top-1/2 left-1/2" style={{ transform: `translate(calc(-50% + ${tx}px), -180px)` }}>
                    <span className="text-[9px] font-black text-[var(--text-muted)]/30 tracking-[0.3em] whitespace-nowrap">{label}</span>
                  </div>
                );
              })}
              {[-220, 0, 220].map(tx => (
                <div key={tx} className="absolute top-[20%] bottom-[20%] left-1/2 w-[1px] bg-[var(--glass-border)]" style={{ transform: `translateX(${tx}px)` }} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar Background */}
      <AnimatePresence>
        {viewMode === 'calendar' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg viewBox="-600 -300 1200 600" className="w-full h-full overflow-visible">
              {[...Array(8)].map((_, i) => (
                <line key={`v-${i}`} x1={(i - 3.5) * CAL_COL_W} y1={-212.5} x2={(i - 3.5) * CAL_COL_W} y2={212.5} stroke="var(--text-muted)" strokeWidth="1" opacity="0.15" />
              ))}
              {[...Array(6)].map((_, i) => (
                <line key={`h-${i}`} x1={-525} y1={(i - 2.5) * CAL_ROW_H} x2={525} y2={(i - 2.5) * CAL_ROW_H} stroke="var(--text-muted)" strokeWidth="1" opacity="0.15" />
              ))}
              {[...Array(30)].map((_, i) => {
                const col = i % 7; const row = Math.floor(i / 7);
                return (
                  <text key={i} x={(col - 3.5) * CAL_COL_W + 10} y={(row - 2.5) * CAL_ROW_H + 20} fill="var(--text-muted)" fontSize="11" fontWeight="900" opacity="0.4" className="font-mono">
                    {(i + 1).toString().padStart(2, '0')}
                  </text>
                );
              })}
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection Lines (Spatial Only) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 overflow-visible">
        <svg className="w-full h-full overflow-visible">
          <g transform={`translate(${containerRef.current?.clientWidth ? containerRef.current.clientWidth / 2 : 0}, ${containerRef.current?.clientHeight ? containerRef.current.clientHeight / 2 : 0})`}>
            <AnimatePresence>
              {viewMode === 'spatial' && nodes.length > 0 && !isTransitioning && activeSpace.stacks.map(stack => {
                const stackNodes = nodes.filter(n => n.id.startsWith(stack.id));
                if (stackNodes.length < 2) return null;
                return stackNodes.map((n, i) => {
                  const next = stackNodes[(i + 1) % stackNodes.length];
                  return (
                    <motion.line 
                      key={`${activeSpace.id}-${stack.id}-${i}`}
                      x1={n.x} y1={n.y} x2={next.x} y2={next.y} 
                      stroke="white" strokeWidth="1" strokeDasharray="4 4"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.3 } }}
                      transition={{ duration: 1.5, delay: 0.8, ease: "easeInOut" }}
                    />
                  );
                });
              })}
            </AnimatePresence>
          </g>
        </svg>
      </div>

      {/* Thoughts */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative">
          <AnimatePresence mode="popLayout">
            {nodes.length > 0 && activeSpace.stacks.flatMap((stack, sIdx) => 
              stack.thoughts.map((thought: any, tIdx) => {
                const id = `${stack.id}-${tIdx}`;
                const node = nodes.find(n => n.id === id);
                if (!node) return null;
                const flatIdx = sIdx * 3 + tIdx;
                
                return (
                  <motion.div 
                    key={`${activeSpace.id}-${id}`} 
                    initial={{ opacity: 0, scale: 0 }} 
                    animate={{ 
                      opacity: 1, 
                      scale: viewMode === 'calendar' ? 0.55 : viewMode === 'kanban' ? 0.85 : 1.0,
                    }} 
                    exit={{ opacity: 0, scale: 0, transition: { duration: 0.4, delay: flatIdx * 0.02 } }} 
                    transition={{ type: "spring", damping: 15, stiffness: 100, delay: flatIdx * 0.08 }} 
                    style={{ 
                      position: 'absolute', 
                      x: node.x, 
                      y: node.y, 
                      left: 0, 
                      top: 0,
                      translateX: '-50%',
                      translateY: '-50%',
                      pointerEvents: 'auto', 
                      zIndex: dragTargetRef.current === id ? 100 : 10 
                    }}
                  >
                    <DemoThought 
                      title={thought.title} 
                      type={thought.type}
                      color={stack.color} 
                      onPointerDown={(e) => { 
                        if (viewMode !== 'spatial') return;
                        e.stopPropagation(); dragTargetRef.current = id; 
                        if (containerRef.current) { 
                          const rect = containerRef.current.getBoundingClientRect(); 
                          dragOffsetRef.current = { x: ((e.clientX - rect.left) - rect.width / 2) - node.x.get(), y: ((e.clientY - rect.top) - rect.height / 2) - node.y.get() }; 
                        } 
                      }} 
                    />
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="absolute bottom-6 left-6 z-[100] flex items-center gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
        
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold tracking-widest text-[var(--text-primary)]">Interactive Workspace</span>
          <span className="text-[8px] font-medium tracking-widest text-[var(--text-muted)]">
            {viewMode === 'spatial' ? 'Physics Simulation' : `${viewMode} view`}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {viewMode === 'spatial' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 0.6, x: 0 }} exit={{ opacity: 0, x: 20 }} whileHover={{ opacity: 1 }} className="absolute bottom-6 right-6 z-[100]">
            <button onClick={() => setPhysicsEnabled(!physicsEnabled)} className={`p-3 rounded-2xl border transition-all flex items-center gap-2 ${physicsEnabled ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-muted)]'}`}><Zap className={`w-4 h-4 ${physicsEnabled ? 'fill-current' : ''}`} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InteractiveDemo;
