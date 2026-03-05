import React, { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react';

import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, animate } from 'framer-motion';

import { MousePointer2, Layout, Database, ArrowRight, Check, Compass, Rocket, Menu, X, Send, Loader2, CheckCircle, Shield, Zap } from 'lucide-react';
import { PLAN_CONFIG } from '../constants';

const DemoWorkspace = lazy(() => import('./demo/DemoWorkspace'));

const FEATURES = [
  {
    id: 'spatial',
    icon: MousePointer2,
    title: 'Spaces, Collections & Thoughts',
    description: 'Organize your mind in a space using thoughts that have mass and physical inertia. Link related thoughts into physical collections. '
  },
  {
    id: 'views',
    icon: Layout,
    title: 'Dynamic Views',
    description: 'Morph space into Spatial, Kanban or Calendar instantly.'
  },
  {
    id: 'cloud',
    icon: Database,
    title: 'Cloud Storage',
    description: 'Cloud storage for research assets, PDFs, and media synced across all devices.'
  },
  {
    id: 'agentic',
    icon: Zap,
    title: 'Agentic Workspace',
    description: 'Deploy advanced agents to research the web and automate your workspace connections.'
  }
];

const MinimalistThought: React.FC<{ 
  title: string; 
  color?: string; 
  className?: string;
  style?: React.CSSProperties;
}> = ({ title, color, className = '', style }) => (
  <div 
    className={`glass border border-white/5 rounded-xl p-3 flex flex-col gap-2 min-w-[140px] shadow-sm backdrop-blur-sm relative overflow-hidden transition-all duration-500 ${className}`}
    style={style}
  >
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-black uppercase tracking-[0.15em] text-white/40">
        {title}
      </span>
      <div 
        className="w-1 h-1 rounded-full" 
        style={{ backgroundColor: color || 'rgba(255,255,255,0.1)' }} 
      />
    </div>
    <div className="space-y-1.5">
      <div className="w-full h-[1px] rounded-full bg-white/5" />
      <div className="w-[70%] h-[1px] rounded-full bg-white/5" />
      <div className="flex gap-1">
        <div className="w-[20%] h-[1px] rounded-full bg-white/5" />
        <div className="w-[30%] h-[1px] rounded-full bg-white/5 opacity-30" />
      </div>
    </div>
    <div className="flex items-center gap-2 mt-0.5">
      <div className="w-3 h-3 rounded bg-white/5 border border-white/5" />
      <div className="w-10 h-1.5 rounded-full bg-white/5" />
    </div>
  </div>
);

const SPACES_DATA = [
  {
    name: 'Engineering',
    cluster: ['RESEARCH_NOTES', 'SYSTEM_ARCH', 'CORE_LOGIC'],
    free: ['INTERFACE_V3', 'USER_FLOW', 'DATABASE_01']
  },
  {
    name: 'Marketing',
    cluster: ['AD_CAMPAIGN', 'ASSET_PACK', 'COPY_DECK'],
    free: ['FB_ADS', 'EMAIL_FLOW', 'SEO_LOG']
  },
  {
    name: 'Personal',
    cluster: ['TRAVEL_PLAN', 'GIFT_IDEAS', 'GROCERIES'],
    free: ['FLIGHT_01', 'HOTEL_CONF', 'PHOTO_DUMP']
  },
];

interface ThoughtNodeData {
  id: number;
  title: string;
  x: any;
  y: any;
}

const ThoughtConnection = ({ nodeA, nodeB }: { nodeA: ThoughtNodeData; nodeB: ThoughtNodeData }) => {
  const x1 = useTransform(nodeA.x, (v: number) => `calc(50% + ${v}px)`);
  const y1 = useTransform(nodeA.y, (v: number) => `calc(50% + ${v}px)`);
  const x2 = useTransform(nodeB.x, (v: number) => `calc(50% + ${v}px)`);
  const y2 = useTransform(nodeB.y, (v: number) => `calc(50% + ${v}px)`);

  return (
    <motion.line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="#cbd5e1"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeDasharray="6 12"
      strokeOpacity={0.35}
      animate={{ strokeDashoffset: [0, -36] }}
      transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
    />
  );
};

const AgenticSpaceVisual = () => {
  const [activeSpaceIdx, setActiveSpaceIdx] = useState(0);
  const [isGrabbing, setIsGrabbing] = useState(false);
  
  const currentSpace = SPACES_DATA[activeSpaceIdx];

  const freeNodes = useMemo(() => [
    { id: 4, title: currentSpace.free[0], x: [220, -260], y: [-240, 160], duration: 34, delay: 1 },
    { id: 5, title: currentSpace.free[1], x: [-200, 280], y: [60, 240], duration: 45, delay: 5 },
    { id: 6, title: currentSpace.free[2], x: [180, -280], y: [-120, 280], duration: 40, delay: 3 },
  ], [currentSpace]);

  const clusterNodes = useMemo(() => [
    { id: 1, title: currentSpace.cluster[0], ox: -80, oy: -60 },
    { id: 2, title: currentSpace.cluster[1], ox: 80, oy: -40 },
    { id: 3, title: currentSpace.cluster[2], ox: 0, oy: 80 },
  ], [currentSpace]);

  // Cursor Motion Values
  const cursorX = useMotionValue(-300);
  const cursorY = useMotionValue(-200);
  const cursorScale = useMotionValue(1);
  const cursorOpacity = useMotionValue(0);

  // Leader Node (RESEARCH_NOTES)
  const node1TargetX = useMotionValue(clusterNodes[0].ox);
  const node1TargetY = useMotionValue(clusterNodes[0].oy);
  
  const node1X = useSpring(node1TargetX, { stiffness: 120, damping: 20 });
  const node1Y = useSpring(node1TargetY, { stiffness: 120, damping: 20 });

  // Followers (Spring towards Leader + relative offset)
  // They are "pulled" with inertia
  const node2X = useSpring(useTransform(node1X, (x: any) => x + (clusterNodes[1].ox - clusterNodes[0].ox)), { stiffness: 35, damping: 15, mass: 2.2 });
  const node2Y = useSpring(useTransform(node1Y, (y: any) => y + (clusterNodes[1].oy - clusterNodes[0].oy)), { stiffness: 35, damping: 15, mass: 2.2 });

  const node3X = useSpring(useTransform(node1X, (x: any) => x + (clusterNodes[2].ox - clusterNodes[0].ox)), { stiffness: 28, damping: 12, mass: 3 });
  const node3Y = useSpring(useTransform(node1Y, (y: any) => y + (clusterNodes[2].oy - clusterNodes[0].oy)), { stiffness: 28, damping: 12, mass: 3 });

  const nodes = useMemo(() => [
    { id: 1, title: currentSpace.cluster[0], x: node1X, y: node1Y },
    { id: 2, title: currentSpace.cluster[1], x: node2X, y: node2Y },
    { id: 3, title: currentSpace.cluster[2], x: node3X, y: node3Y },
  ], [currentSpace.cluster, node1X, node1Y, node2X, node2Y, node3X, node3Y]);

  useEffect(() => {
    let mounted = true;
    let unsubscribeX: (() => void) | null = null;
    let unsubscribeY: (() => void) | null = null;

    const cleanupSubscriptions = () => {
      if (unsubscribeX) { unsubscribeX(); unsubscribeX = null; }
      if (unsubscribeY) { unsubscribeY(); unsubscribeY = null; }
    };

    const runAnimation = async () => {
      // Immediate reset for a clean start when space changes
      cursorOpacity.stop();
      cursorX.stop();
      cursorY.stop();
      node1TargetX.stop();
      node1TargetY.stop();
      cursorScale.stop();

      cursorOpacity.set(0);
      cursorX.set(-300);
      cursorY.set(-200);
      node1TargetX.set(clusterNodes[0].ox);
      node1TargetY.set(clusterNodes[0].oy);
      setIsGrabbing(false);

      while (mounted) {
        // Init: Cursor appears
        animate(cursorOpacity, 1, { duration: 0.8 });
        
        // 1. Cursor moves to RESEARCH_NOTES
        await Promise.all([
          animate(cursorX, clusterNodes[0].ox, { duration: 2, ease: "easeInOut" }),
          animate(cursorY, clusterNodes[0].oy, { duration: 2, ease: "easeInOut" })
        ]);
        
        if (!mounted) break;

        // 2. Grab (Pulse effect)
        await animate(cursorScale, 1.3, { duration: 0.3, type: "spring" });
        setIsGrabbing(true);
        
        // Bind leader target to cursor
        cleanupSubscriptions();
        unsubscribeX = cursorX.on("change", v => node1TargetX.set(v));
        unsubscribeY = cursorY.on("change", v => node1TargetY.set(v));

        // 3. Drag smoothly across the stage
        await Promise.all([
          animate(cursorX, 160, { duration: 3.5, ease: [0.33, 1, 0.68, 1] }),
          animate(cursorY, 40, { duration: 3.5, ease: [0.33, 1, 0.68, 1] })
        ]);
        
        if (!mounted) break;

        await new Promise(r => setTimeout(r, 1000));

        // 4. Release
        cleanupSubscriptions();
        setIsGrabbing(false);
        await animate(cursorScale, 1, { duration: 0.4 });
        
        // 5. Drift back: Leader node returns home
        animate(node1TargetX, clusterNodes[0].ox, { duration: 2.5, ease: "easeOut" });
        animate(node1TargetY, clusterNodes[0].oy, { duration: 2.5, ease: "easeOut" });

        // 6. Cursor moves away and fades
        await Promise.all([
          animate(cursorX, -300, { duration: 2, ease: "easeInOut" }),
          animate(cursorY, -200, { duration: 2, ease: "easeInOut" }),
          animate(cursorOpacity, 0, { duration: 2 })
        ]);

        if (!mounted) break;
        await new Promise(r => setTimeout(r, 2000));
        setActiveSpaceIdx(prev => (prev + 1) % SPACES_DATA.length);
      }
    };

    runAnimation();

    return () => { 
      mounted = false;
      cleanupSubscriptions();
      cursorX.stop();
      cursorY.stop();
      cursorScale.stop();
      cursorOpacity.stop();
      node1TargetX.stop();
      node1TargetY.stop();
      setIsGrabbing(false);
    };
  }, [activeSpaceIdx, clusterNodes, cursorOpacity, cursorScale, cursorX, cursorY, node1TargetX, node1TargetY]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-transparent">
      <div className="absolute inset-0 opacity-[0.05]" style={{ 
        backgroundImage: `radial-gradient(circle at 1px 1px, var(--accent) 0.5px, transparent 0)`,
        backgroundSize: '40px 40px',
        maskImage: 'radial-gradient(circle at center, black, transparent 80%)'
      }} />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSpaceIdx}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {/* Free Drifting Nodes (Background) */}
          {freeNodes.map((node) => (
            <motion.div
              key={node.title}
              className="absolute left-1/2 top-1/2"
              animate={{ x: node.x, y: node.y, rotate: [0, 8, -8, 0] }}
              transition={{ 
                x: { duration: node.duration, repeat: Infinity, ease: "linear", delay: -node.delay },
                y: { duration: node.duration * 0.9, repeat: Infinity, ease: "linear", delay: -node.delay },
                rotate: { duration: 12, repeat: Infinity, ease: "easeInOut" }
              }}
            >
              <div className="-translate-x-1/2 -translate-y-1/2">
                <MinimalistThought title={node.title} className="scale-90 opacity-40" />
              </div>
            </motion.div>
          ))}

          {/* Interacting Cluster */}
          <div className="absolute inset-0 pointer-events-none">
            <svg className="absolute inset-0 w-full h-full overflow-visible">
              {[
                [0, 1],
                [1, 2],
                [2, 0],
              ].map(([i, j]) => (
                <ThoughtConnection key={`${i}-${j}`} nodeA={nodes[i]} nodeB={nodes[j]} />
              ))}
            </svg>

            {nodes.map((node, i) => (
              <motion.div
                key={node.title}
                className="absolute left-1/2 top-1/2"
                style={{ 
                  x: node.x, 
                  y: node.y, 
                  scale: (i === 0 && isGrabbing) ? 1.05 : 0.9 
                }}
              >
                <div className="-translate-x-1/2 -translate-y-1/2">
                  <MinimalistThought title={node.title} className="shadow-2xl" />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>


      {/* Animated Cursor - Outside AnimatePresence to stay persistent */}
      <motion.div
        className="absolute left-1/2 top-1/2 z-[100] pointer-events-none"
        style={{ 
          x: cursorX, 
          y: cursorY, 
          scale: cursorScale, 
          opacity: cursorOpacity 
        }}
      >
        <div className="relative">
          <MousePointer2 className="w-6 h-6 text-white fill-white/20 -translate-x-1 translate-y-1 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
          {isGrabbing && (
            <motion.div 
              className="absolute inset-0 w-6 h-6 bg-white/40 rounded-full blur-xl"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.2, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </div>
      </motion.div>

      {/* Space Switcher */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-1.5 p-1.5 glass rounded-full border border-white/5">
        {SPACES_DATA.map((space, idx) => (
          <button
            key={space.name}
            onClick={() => setActiveSpaceIdx(idx)}
            className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${
              activeSpaceIdx === idx 
                ? 'bg-white text-black shadow-lg shadow-white/10' 
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            {space.name}
          </button>
        ))}
      </div>
    </div>
  );
};


const DynamicViewsVisual = () => {
  const [view, setView] = useState<'spatial' | 'kanban' | 'calendar'>('spatial');

  useEffect(() => {
    const timer = setInterval(() => {
      setView(prev => {
        if (prev === 'spatial') return 'kanban';
        if (prev === 'kanban') return 'calendar';
        return 'spatial';
      });
    }, 4000);
    return () => clearInterval(timer);
  }, []);
  
  const thoughts = [
    { id: 1, title: 'TASKS_01', color: 'var(--accent)' },
    { id: 2, title: 'PROCESS_A', color: 'var(--accent-secondary)' },
    { id: 3, title: 'DATA_NODE', color: 'var(--accent)' },
    { id: 4, title: 'RESEARCH', color: 'var(--accent-secondary)' },
    { id: 5, title: 'FEEDBACK', color: 'var(--accent)' },
    { id: 6, title: 'DEPLOY', color: 'var(--accent-secondary)' },
  ];

  const getPosition = (index: number, currentView: string) => {
    if (currentView === 'spatial') {
      const positions = [
        { x: -150, y: -140 }, { x: 140, y: -160 },
        { x: -120, y: 120 }, { x: 160, y: 100 },
        { x: 20, y: -30 }, { x: -220, y: 30 }
      ];
      return positions[index];
    }
    if (currentView === 'kanban') {
      const cols = [-200, 0, 200];
      const colIdx = index % 3;
      const rowIdx = Math.floor(index / 3);
      return { x: cols[colIdx], y: -80 + rowIdx * 160 };
    }
    if (currentView === 'calendar') {
      const grid = [
        { col: 1, row: 0 }, { col: 3, row: 0 }, { col: 5, row: 0 },
        { col: 0, row: 1 }, { col: 2, row: 1 }, { col: 4, row: 1 }
      ];
      const { col, row } = grid[index % grid.length];
      return { x: (col - 3) * 85, y: -120 + row * 80 };
    }
    return { x: 0, y: 0 };
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-transparent overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ 
        backgroundImage: `radial-gradient(circle at 1px 1px, var(--accent) 1px, transparent 0)`,
        backgroundSize: '40px 40px' 
      }} />

      <AnimatePresence>
        {view === 'kanban' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex justify-around items-start pt-32 px-12 pointer-events-none"
          >
            {['TODO', 'DOING', 'DONE'].map(label => (
              <span key={label} className="text-[10px] font-black text-white/10 tracking-[0.4em] uppercase">{label}</span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {view === 'calendar' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          >
            {/* Background Pulse */}
            <motion.div 
              className="absolute w-[600px] h-[400px] bg-[var(--accent)]/5 rounded-full blur-[100px]"
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.2, 0.4, 0.2]
              }}
              transition={{ 
                duration: 8, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
            />

            {/* Date Numbers */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(30)].map((_, i) => {
                const n = i + 1;
                const col = (n - 1) % 7;
                const row = Math.floor((n - 1) / 7);
                return (
                  <div 
                    key={n}
                    className="absolute text-[8px] font-black text-white/20 tracking-tighter"
                    style={{
                      left: `calc(50% + ${(col - 2.5) * 85}px - 10px)`,
                      top: `calc(50% - 160px + ${row * 80}px + 10px)`,
                      transform: 'translateX(-100%)'
                    }}
                  >
                    {n}
                  </div>
                );
              })}
            </div>
            <svg className="absolute inset-0 w-full h-full overflow-visible">
              {[...Array(8)].map((_, i) => (
                <React.Fragment key={`v-${i}`}>
                  {/* Glow Line */}
                  <line 
                    x1={`calc(50% + ${(i - 3.5) * 85}px)`} y1="calc(50% - 160px)"
                    x2={`calc(50% + ${(i - 3.5) * 85}px)`} y2="calc(50% + 240px)"
                    stroke="white" strokeOpacity="0.1" strokeWidth="3"
                    style={{ filter: 'blur(2px)' }}
                  />
                  {/* Base Line */}
                  <line 
                    x1={`calc(50% + ${(i - 3.5) * 85}px)`} y1="calc(50% - 160px)"
                    x2={`calc(50% + ${(i - 3.5) * 85}px)`} y2="calc(50% + 240px)"
                    stroke="white" strokeOpacity="0.2" strokeWidth="1"
                  />
                </React.Fragment>
              ))}
              {[...Array(6)].map((_, i) => (
                <React.Fragment key={`h-${i}`}>
                  {/* Glow Line */}
                  <line 
                    x1="calc(50% - 297.5px)" y1={`calc(50% - 160px + ${i * 80}px)`}
                    x2="calc(50% + 297.5px)" y2={`calc(50% - 160px + ${i * 80}px)`}
                    stroke="white" strokeOpacity="0.1" strokeWidth="3"
                    style={{ filter: 'blur(2px)' }}
                  />
                  {/* Base Line */}
                  <line 
                    x1="calc(50% - 297.5px)" y1={`calc(50% - 160px + ${i * 80}px)`}
                    x2="calc(50% + 297.5px)" y2={`calc(50% - 160px + ${i * 80}px)`}
                    stroke="white" strokeOpacity="0.2" strokeWidth="1"
                  />
                </React.Fragment>
              ))}
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {thoughts.map((t, i) => {
        const pos = getPosition(i, view);
        return (
          <motion.div
            key={t.id}
            className="absolute"
            animate={{ 
              x: pos.x, 
              y: pos.y,
              scale: view === 'calendar' ? 0.75 : 0.9,
              rotate: view === 'spatial' ? (i * 5 - 10) : 0
            }}
            transition={{ 
              type: "spring",
              damping: 25,
              stiffness: 80,
              mass: 1.2
            }}
          >
            <MinimalistThought title={t.title} color={t.color} />
          </motion.div>
        );
      })}

      {/* View Switcher */}
      <div className="absolute top-8 right-8 z-[110] flex items-center gap-1.5 p-1.5 glass rounded-full border border-white/5">
        {(['spatial', 'kanban', 'calendar'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${
              view === v 
                ? 'bg-white text-black shadow-lg shadow-white/10' 
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
};

const CloudPersistenceVisual = () => {
  const [phase, setPhase] = useState<'upload' | 'pulse' | 'distribute' | 'success' | 'idle'>('idle');

  useEffect(() => {
    let mounted = true;
    const sequence = async () => {
      while (mounted) {
        setPhase('upload');
        await new Promise(r => setTimeout(r, 2200));
        if (!mounted) break;
        
        setPhase('pulse');
        await new Promise(r => setTimeout(r, 800));
        if (!mounted) break;

        setPhase('distribute');
        await new Promise(r => setTimeout(r, 1500));
        if (!mounted) break;

        setPhase('success');
        await new Promise(r => setTimeout(r, 1500));
        if (!mounted) break;

        setPhase('idle');
        await new Promise(r => setTimeout(r, 1000));
      }
    };
    sequence();
    return () => { mounted = false; };
  }, []);

  const devices = [
    { id: 'desktop', label: 'Desktop', x: -240, y: 0, type: 'monitor' },
    { id: 'mobile', label: 'Mobile', x: 240, y: 0, type: 'phone' },
    { id: 'laptop-top', label: 'Laptop', x: 0, y: -180, type: 'laptop' },
    { id: 'laptop-bottom', label: 'Laptop', x: 0, y: 180, type: 'laptop' },
  ];

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-transparent overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ 
        backgroundImage: `radial-gradient(circle at 1px 1px, var(--accent) 1px, transparent 0)`,
        backgroundSize: '40px 40px' 
      }} />

      {/* 1. Cloud Hub (Center) */}
      <div className="relative z-20">
        <div className="relative flex items-center justify-center">
          {/* Rotating Sync Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute w-40 h-40 opacity-20"
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle 
                cx="50" cy="50" r="48" 
                stroke="white" strokeWidth="0.5" fill="none" 
                strokeDasharray="4 6" 
              />
            </svg>
          </motion.div>

          {/* Core Node */}
          <div className="w-[110px] h-[110px] rounded-full border border-white/10 glass bg-white/[0.02] flex items-center justify-center relative group shadow-2xl">
            <div className="absolute inset-0 bg-[var(--accent)]/5 blur-3xl rounded-full" />
            <Database className="w-10 h-10 text-white/40 group-hover:text-[var(--accent)] transition-colors duration-500" />
            
            <AnimatePresence>
              {phase === 'pulse' && (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 2.5, opacity: [0, 1, 0] }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-[radial-gradient(circle,var(--accent)_0%,transparent_70%)] opacity-40 rounded-full blur-xl"
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="absolute top-[120%] left-1/2 -translate-x-1/2">
          <span className="text-[8px] font-black tracking-[0.4em] text-white/30 uppercase whitespace-nowrap">Cloud Storage</span>
        </div>
      </div>

      {/* 2. Devices */}
      {devices.map((device) => (
        <div 
          key={device.id} 
          className="absolute left-1/2 top-1/2" 
          style={{ transform: `translate(calc(-50% + ${device.x}px), calc(-50% + ${device.y}px))` }}
        >
          <div className="flex flex-col items-center gap-4">
            <motion.div 
              className="relative"
              animate={phase === 'success' ? { 
                scale: [1, 1.05, 1],
                filter: ['drop-shadow(0 0 0px transparent)', 'drop-shadow(0 0 15px #22c55e44)', 'drop-shadow(0 0 0px transparent)']
              } : {}}
              transition={{ duration: 0.6 }}
            >
              {device.type === 'monitor' && (
                <div className="flex flex-col items-center">
                  <div className="w-[100px] h-[75px] rounded-lg border border-white/10 glass bg-white/[0.01] p-1.5 relative shadow-xl overflow-hidden">
                    <div className="w-full h-full rounded-md bg-black/40 border border-white/5" />
                  </div>
                  <div className="w-4 h-3 bg-white/5 border-x border-white/10 opacity-50" />
                  <div className="w-10 h-0.5 bg-white/10 rounded-full opacity-50" />
                </div>
              )}
              {device.type === 'phone' && (
                <div className="w-[50px] h-[90px] rounded-xl border border-white/15 glass bg-white/[0.01] p-1 relative shadow-xl overflow-hidden">
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-black/60 border border-white/5" />
                  <div className="w-full h-full rounded-lg bg-black/40 border border-white/5" />
                </div>
              )}
              {device.type === 'laptop' && (
                <div className="flex flex-col items-center">
                  <div className="w-[90px] h-[60px] rounded-t-lg border border-white/10 glass bg-white/[0.01] p-1.5 relative shadow-xl overflow-hidden">
                    <div className="w-full h-full rounded-md bg-black/40 border border-white/5" />
                  </div>
                  <div className="w-[105px] h-1.5 bg-white/10 rounded-b-lg border-x border-b border-white/10" />
                </div>
              )}
            </motion.div>
            <span className="text-[7px] font-black tracking-[0.3em] text-white/20 uppercase">{device.label}</span>
          </div>
        </div>
      ))}

      {/* 3. The Sync Sequence (Cards) */}
      <AnimatePresence>
        {/* Phase 1: Upload (Desktop -> Hub) */}
        {phase === 'upload' && (
          <motion.div
            className="absolute left-1/2 top-1/2 z-30"
            initial={{ x: -240, y: 0, opacity: 0, scale: 0.7 }}
            animate={{ 
              x: [ -240, -240, 0, 0 ], 
              y: [ 0, 0, 0, 0 ],
              opacity: [ 0, 1, 1, 0 ],
              scale: [ 0.7, 0.9, 0.9, 0 ],
            }}
            transition={{ 
              duration: 2.2,
              times: [0, 0.15, 0.85, 1],
              ease: "easeInOut"
            }}
          >
            <div className="-translate-x-1/2 -translate-y-1/2 relative">
              <MinimalistThought title="UPLOAD_SYNC" className="shadow-2xl" />
              {/* Overlay dot that animates color */}
              <motion.div 
                className="absolute top-[15px] right-[15px] w-1 h-1 rounded-full z-10"
                animate={{ backgroundColor: ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.2)', 'var(--accent)', 'var(--accent)'] }}
                transition={{ duration: 2.2, times: [0, 0.45, 0.55, 1] }}
              />
            </div>
          </motion.div>
        )}

        {/* Phase 4: Distribution (Hub -> All Devices) */}
        {phase === 'distribute' && devices.map((device, i) => (
          <motion.div
            key={`dist-${device.id}`}
            className="absolute left-1/2 top-1/2 z-30"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
            animate={{ 
              x: [ 0, device.x ], 
              y: [ 0, device.y ],
              opacity: [ 0, 1, 1 ],
              scale: [ 0, 0.7, 0.7 ],
            }}
            transition={{ 
              duration: 1.2,
              delay: i * 0.05,
              ease: [0.16, 1, 0.3, 1]
            }}
          >
            <div className="-translate-x-1/2 -translate-y-1/2 relative">
              <MinimalistThought title="SYNCED" className="shadow-xl" />
              <div 
                className="absolute top-[14px] right-[14px] w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: '#22c55e' }}
              />
            </div>
          </motion.div>
        ))}
        
        {/* Persistent Synced Cards during success phase */}
        {phase === 'success' && devices.map((device) => (
          <motion.div
            key={`success-${device.id}`}
            className="absolute left-1/2 top-1/2 z-30"
            initial={{ x: device.x, y: device.y, opacity: 1, scale: 0.7 }}
            animate={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <div className="-translate-x-1/2 -translate-y-1/2 relative">
              <MinimalistThought title="SYNCED" className="shadow-xl" />
              <div 
                className="absolute top-[14px] right-[14px] w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: '#22c55e' }}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

const AgenticWorkspaceVisual = () => {
  const [promptText, setPromptText] = useState("");
  const [stage, setStage] = useState<'prompt' | 'beam' | 'spawn' | 'linked' | 'settled'>('prompt');
  const fullPrompt = "Research on topic X, find me 3 related videos from youtube and link them.";

  const freeNodes = [
    { id: 'f1', title: 'RESEARCH_REF', x: [300, -300], y: [-200, 200], duration: 45, delay: 0, opacity: 0.85 },
    { id: 'f2', title: 'API_DOCS', x: [-350, 350], y: [150, -150], duration: 55, delay: 10, opacity: 0.85 },
    { id: 'f3', title: 'MARKET_DATA', x: [200, -200], y: [250, -250], duration: 65, delay: 5, opacity: 0.85 },
    { id: 'f4', title: 'STRATEGY_V1', x: [-250, 250], y: [-300, 300], duration: 50, delay: 15, opacity: 0.85 },
  ];
  
  useEffect(() => {
    let mounted = true;
    const runSequence = async () => {
      while (mounted) {
        setStage('prompt');
        setPromptText("");
        
        // Typing effect
        for (let i = 0; i <= fullPrompt.length; i++) {
          if (!mounted) break;
          setPromptText(fullPrompt.slice(0, i));
          await new Promise(r => setTimeout(r, 60));
        }
        
        if (!mounted) break;
        await new Promise(r => setTimeout(r, 600));
        setStage('beam');
        
        // We handle transitions via stages
        await new Promise(r => setTimeout(r, 500)); // wait for beam duration
        if (!mounted) break;
        setStage('spawn');
        await new Promise(r => setTimeout(r, 800));
        if (!mounted) break;
        setStage('linked');
        await new Promise(r => setTimeout(r, 1200));
        if (!mounted) break;
        setStage('settled');
        
        // Hold for a moment then restart
        await new Promise(r => setTimeout(r, 5000));
      }
    };
    runSequence();
    return () => { mounted = false; };
  }, []);

  const cards = [
    { id: '1', title: 'YOUTUBE_01', tx: -180, ty: 40 },
    { id: '2', title: 'YOUTUBE_02', tx: 180, ty: 60 },
    { id: '3', title: 'YOUTUBE_03', tx: 0, ty: 200 },
  ];

  return (
    <div className="relative w-full h-full bg-transparent overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-[0.04]" style={{ 
        backgroundImage: `radial-gradient(circle at 1px 1px, var(--accent) 1px, transparent 0)`,
        backgroundSize: '40px 40px' 
      }} />

      {/* Free Drifting Nodes (Background) */}
      {freeNodes.map((node) => (
        <motion.div
          key={node.id}
          className="absolute left-1/2 top-1/2"
          animate={{ x: node.x, y: node.y, rotate: [0, 8, -8, 0] }}
          transition={{ 
            x: { duration: node.duration, repeat: Infinity, ease: "linear", delay: -node.delay },
            y: { duration: node.duration * 1.1, repeat: Infinity, ease: "linear", delay: -node.delay },
            rotate: { duration: 15, repeat: Infinity, ease: "easeInOut" }
          }}
          style={{ opacity: node.opacity }}
        >
          <div className="-translate-x-1/2 -translate-y-1/2">
            <MinimalistThought title={node.title} className="scale-75" />
          </div>
        </motion.div>
      ))}

      {/* Request Area */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[10%] z-30">
        <motion.div 
          className="w-[360px] h-20 glass border border-white/10 rounded-[2rem] flex items-center px-6 relative overflow-hidden shadow-2xl"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex flex-col w-full">
            <span className="text-[8px] font-black tracking-[0.4em] text-white/20 uppercase mb-1">ORACLE AI</span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-[var(--accent-secondary)] tracking-wider font-bold">
                {">"} {promptText}
                <motion.span 
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                  className="inline-block w-[6px] h-[12px] bg-[var(--accent-secondary)] ml-1 align-middle"
                />
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Data Beam */}
      <AnimatePresence>
        {stage === 'beam' && (
          <motion.div
            className="absolute left-1/2 w-[2px] bg-gradient-to-b from-[var(--accent-secondary)] to-white shadow-[0_0_20px_var(--accent-secondary)] z-20"
            initial={{ top: '23%', height: 0, opacity: 1, translateX: '-50%' }}
            animate={{ height: '27%', opacity: [1, 1, 0] }}
            transition={{ duration: 0.5, ease: "circIn" }}
          />
        )}
      </AnimatePresence>

      {/* Interaction Stage */}
      <motion.div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        animate={(stage === 'linked' || stage === 'settled') ? {
          rotate: [0, 4, -4, 0],
          x: [0, 40, -40, 0],
          y: [0, -20, 20, 0]
        } : {}}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {/* Weaving Lines */}
        <svg className="absolute inset-0 w-full h-full overflow-visible">
          {(stage === 'linked' || stage === 'settled') && [
            [0, 1], [1, 2], [2, 0]
          ].map(([i, j]) => (
            <motion.line
              key={`${i}-${j}`}
              initial={{ 
                pathLength: 0,
                x1: `calc(50% + ${cards[i].tx}px)`,
                y1: `calc(50% + ${cards[i].ty}px)`,
                x2: `calc(50% + ${cards[j].tx}px)`,
                y2: `calc(50% + ${cards[j].ty}px)`,
              }}
      animate={{ 
        pathLength: 1,
        x1: `calc(50% + ${cards[i].tx * (stage === 'settled' ? 0.75 : 1)}px)`,
        y1: `calc(50% + ${cards[i].ty * (stage === 'settled' ? 0.75 : 1)}px)`,
        x2: `calc(50% + ${cards[j].tx * (stage === 'settled' ? 0.75 : 1)}px)`,
        y2: `calc(50% + ${cards[j].ty * (stage === 'settled' ? 0.75 : 1)}px)`,
      }}
      transition={{ 
        pathLength: { duration: 1.2, ease: "easeInOut" },
        x1: { type: "spring", stiffness: 400, damping: 25 },
        y1: { type: "spring", stiffness: 400, damping: 25 },
        x2: { type: "spring", stiffness: 400, damping: 25 },
        y2: { type: "spring", stiffness: 400, damping: 25 },
      }}
              stroke="#cbd5e1"
              strokeOpacity="0.35"
              strokeWidth="1"
            />
          ))}
        </svg>

        {/* Action Cards */}
        {(stage === 'spawn' || stage === 'linked' || stage === 'settled') && cards.map((card, i) => (
          <motion.div
            key={card.id}
            className="absolute left-1/2 top-1/2"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
            animate={{ 
              x: stage === 'settled' ? card.tx * 0.75 : card.tx, 
              y: stage === 'settled' ? card.ty * 0.75 : card.ty, 
              opacity: 1, 
              scale: 0.9,
              rotate: (stage === 'linked' || stage === 'settled') ? [0, i % 2 === 0 ? 3 : -3, 0] : 0
            }}
            transition={{
              x: { 
                type: "spring", 
                stiffness: stage === 'settled' ? 400 : 120, 
                damping: stage === 'settled' ? 25 : 14, 
                delay: stage === 'spawn' ? i * 0.05 : 0 
              },
              y: { 
                type: "spring", 
                stiffness: stage === 'settled' ? 400 : 120, 
                damping: stage === 'settled' ? 25 : 14, 
                delay: stage === 'spawn' ? i * 0.05 : 0 
              },
              opacity: { duration: 0.3 },
              scale: { type: "spring", stiffness: 200, damping: 20 },
              rotate: { duration: 6 + i, repeat: Infinity, ease: "easeInOut" }
            }}
          >
            <div className="-translate-x-1/2 -translate-y-1/2">
              <MinimalistThought 
                title={card.title} 
                className="shadow-2xl" 
                color="var(--accent-secondary)" 
              />
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

const ResponsiveStage = ({ children }: { children: React.ReactNode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const height = containerRef.current.offsetHeight;
        const designSize = 600;
        const newScale = Math.min(width, height) / designSize;
        setScale(Math.max(0.4, newScale)); // Minimum scale of 0.4 to prevent disappearance
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative flex items-center justify-center overflow-hidden">
      <motion.div 
        style={{ scale, width: 600, height: 600 }} 
        className="relative flex-shrink-0 origin-center will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
};

const FeatureVisual: React.FC<{ activeFeature: number }> = ({ activeFeature }) => {
  return (
    <ResponsiveStage>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeFeature}
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(20px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 1.05, filter: 'blur(20px)' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full h-full"
        >
          {activeFeature === 0 && <AgenticSpaceVisual />}
          {activeFeature === 1 && <DynamicViewsVisual />}
          {activeFeature === 2 && <CloudPersistenceVisual />}
          {activeFeature === 3 && <AgenticWorkspaceVisual />}
        </motion.div>
      </AnimatePresence>
    </ResponsiveStage>
  );
};


const Homepage: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location, setLocation] = useState<{ country: string; currency: string; isLocalPricing: boolean } | null>(null);
  
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);
  const [contactSubmitStatus, setContactSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactMessage.trim() || isContactSubmitting) return;
    setIsContactSubmitting(true);
    setContactSubmitStatus('idle');
    try {
      const res = await fetch('/api/feedback?action=contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: contactName, email: contactEmail, message: contactMessage })
      });
      if (res.ok) {
        setContactSubmitStatus('success');
        setContactMessage('');
        setContactName('');
        setContactEmail('');
        setTimeout(() => setContactSubmitStatus('idle'), 5000);
      } else setContactSubmitStatus('error');
    } catch { setContactSubmitStatus('error'); } finally { setIsContactSubmitting(false); }
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const userLanguage = navigator.language;
    const isTunisiaLikely = userTimezone === 'Africa/Tunis' || userLanguage.includes('ar-TN') || userLanguage.includes('fr-TN');

    fetch('/api/pay?action=pricing')
      .then(res => res.json())
      .then(data => {
        if (data.country === 'US' && isTunisiaLikely) {
          setLocation({ country: 'TN', currency: 'DT', isLocalPricing: true });
        } else {
          setLocation(data);
        }
      })
      .catch(() => setLocation({
        country: isTunisiaLikely ? 'TN' : 'US',
        currency: isTunisiaLikely ? 'DT' : 'USD',
        isLocalPricing: isTunisiaLikely
      }));
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  const proPrice = PLAN_CONFIG.pro.PRICE!;
  const savingsUsd = proPrice.monthly.usd * 12 - proPrice.yearly.usd;
  const savingsTnd = proPrice.monthly.tnd * 12 - proPrice.yearly.tnd;

  return (
    <div className="min-h-screen bg-[#020408] text-[#e2e8f0] overflow-y-auto selection:bg-[var(--accent)]/30">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="stars-layer stars-1" />
        <div className="stars-layer stars-2" />
        <div className="stars-layer stars-twinkle" />
        <div className="nebula-cloud" />
        <div className="grain" />
      </div>

      <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${
        isScrolled 
          ? 'bg-[#020408]/40 backdrop-blur-3xl shadow-sm shadow-white/5 py-3' 
          : 'bg-transparent py-4'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="relative">
              <img src="/logo.png" alt="Cyberia Workspace" className="w-10 h-10 object-contain relative z-10 group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-[var(--accent)]/20 blur-xl rounded-full scale-0 group-hover:scale-150 transition-transform duration-700" />
            </div>
            <span className="text-2xl font-black tracking-tighter uppercase">
              Cyberia <span style={{ color: 'var(--accent)' }}>Workspace</span>
            </span>
          </div>

          {/* Desktop Nav - ViewSwitcher Style */}
          <div className="hidden md:flex items-center gap-3"> {/* Increased gap slightly to 3 */}
  {/* The Nav Container */}
  <div className="flex items-center h-10 p-1 rounded-2xl">
    {['features', 'pricing', 'about', 'contact'].map((item) => (
      <button 
        key={item}
        onClick={() => scrollToSection(item)} 
        className="px-3 h-full rounded-xl transition-all duration-300 flex items-center group/nav"
      >
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 group-hover/nav:text-white transition-colors">
          {item}
        </span>
      </button>
    ))}
  </div>

  {/* The CTA Button - Now height matched and radius matched */}
  <a 
    href="https://app.cyberia.tn" 
    className="h-10 px-6 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all shadow-lg shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/40 flex items-center justify-center border border-white/10"
  >
    Open Workspace
  </a>
</div>

          {/* Mobile Toggle */}
          <button 
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden glass border-t border-white/5 overflow-hidden"
            >
              <div className="flex flex-col p-6 gap-6">
                {['features', 'pricing', 'about', 'contact'].map((item) => (
                  <button 
                    key={item}
                    onClick={() => scrollToSection(item)} 
                    className="text-left text-[12px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-[var(--accent-secondary)] transition-colors"
                  >
                    {item}
                  </button>
                ))}
                <a href="https://app.cyberia.tn" className="w-full py-3 bg-[var(--accent)] text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all text-center">
                  Launch App
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <section className="pt-40 pb-24 px-6 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
          >
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8 uppercase">
              Your Mind, <br />
              <span style={{ color: 'var(--accent)' }}>In Motion</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
              Organize docs, tables, images, tasks, links, files, etc... in an infinite agentic workspace where thoughts have <span className="text-white font-bold">mass and gravity</span>. <br />
              <span style={{ color: 'var(--accent-secondary)' }}>Powered by AI agents that research and connect your thoughts.</span>
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
              <button 
                onClick={() => scrollToSection('features')}
                className="w-full sm:w-auto px-10 py-5 glass hover:bg-white/10 rounded-[1.5rem] text-xs font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3"
              >
                Explore Features
              </button>
              <a 
                href="https://app.cyberia.tn"
                className="w-full sm:w-auto px-10 py-5 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.3em] transition-all shadow-2xl shadow-[var(--accent)]/30 active:scale-[0.98] flex items-center justify-center gap-3 group"
              >
                Enter Cyberia
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          viewport={{ once: true }}
          className="block max-w-6xl mx-auto mt-16 md:mt-24 px-4 md:px-0 relative"
        >
          <Suspense fallback={
            <div className="w-full h-[400px] md:h-[600px] glass rounded-[2rem] md:rounded-[3rem] animate-pulse flex items-center justify-center">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Initializing Core Engine...</span>
            </div>
          }>
            <DemoWorkspace />
          </Suspense>
          
              <div className="absolute inset-0 bg-[var(--accent)]/10 blur-[100px] rounded-full pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[var(--accent)]/10 blur-[100px] rounded-full pointer-events-none" />
        </motion.div>
      </section>

      <section id="features" className="py-32 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <div className="max-w-2xl">
<h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-6">
                Redefining <br /><span style={{ color: 'var(--accent)' }}>Thinking Architecture</span>
              </h2>
              <p className="text-slate-400 font-medium leading-relaxed">
                Designed for non-linear thinkers, visionaries, and digital architects. We believe that productivity shouldn't feel like a spreadsheet. It should feel like a world.
              </p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:gap-12 items-start">
            {/* Left Column: Feature Cards */}
            <div className="w-full lg:w-1/2 space-y-4">
              {FEATURES.map((feature, index) => (
                <motion.div
                  key={feature.id}
                  onMouseEnter={() => setActiveFeature(index)}
                  onClick={() => setActiveFeature(index)}
                  className={`relative p-8 rounded-[2.5rem] transition-all duration-500 cursor-pointer group overflow-hidden ${
                    activeFeature === index 
                      ? 'glass border-[var(--accent)]/30 bg-[var(--accent)]/5 shadow-2xl shadow-[var(--accent)]/10' 
                      : 'border border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="relative z-10 flex items-start gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                      activeFeature === index 
                        ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/40' 
                        : 'bg-white/5 text-slate-500 group-hover:text-slate-300'
                    }`}>
                      <feature.icon className="w-7 h-7" />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className={`text-[14px] font-black uppercase tracking-[0.2em] mb-2 transition-colors ${
                        activeFeature === index ? 'text-white' : 'text-slate-400'
                      }`}>
                        {feature.title}
                      </h3>
                      <p className={`text-[11px] leading-relaxed uppercase font-bold tracking-widest transition-all duration-500 ${
                        activeFeature === index ? 'text-slate-300 opacity-100' : 'text-slate-600 opacity-0 h-0 overflow-hidden group-hover:h-auto group-hover:opacity-60'
                      }`}>
                        {feature.description}
                      </p>
                    </div>
                  </div>

                  <AnimatePresence>
                    {activeFeature === index && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="lg:hidden mt-6 aspect-square glass rounded-3xl overflow-hidden relative"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-transparent opacity-50" />
                        <FeatureVisual activeFeature={index} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {activeFeature === index && (
                    <motion.div 
                      layoutId="active-pill"
                      className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/5 to-transparent pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    />
                  )}
                </motion.div>
              ))}
            </div>

            {/* Right Column: Visual Stage */}
            <div className="hidden lg:block lg:w-1/2 sticky top-32">
              <div className="bg-[#020408] aspect-square lg:aspect-auto lg:h-[600px] rounded-[3rem] border border-white/10 overflow-hidden relative group isolate">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-transparent opacity-50" />
                <FeatureVisual activeFeature={activeFeature} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-32 px-6 relative z-10 bg-[var(--accent)]/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
<h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-6">
              Unlock <span style={{ color: 'var(--accent)' }}>Your Potential</span>
            </h2>
            <p className="text-slate-400 font-medium">Start for free, upgrade when you're ready.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass p-10 rounded-[3rem] border-white/5 flex flex-col hover:-translate-y-2 transition-all duration-500 group"
            >
              <div className="mb-8">
                <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white mb-2 group-hover:text-[var(--accent-secondary)] transition-colors">Explorer</h3>
                <div className="text-4xl font-black text-white group-hover:scale-105 transition-transform origin-left duration-500">$0 <span className="text-sm text-slate-500 font-bold uppercase tracking-widest">/ Forever</span></div>
              </div>
              <div className="space-y-4 mb-10 flex-1">
                <PricingFeature text={`${PLAN_CONFIG.free.MAX_SPACES} Agentic Spaces`} />
                <PricingFeature text={`${PLAN_CONFIG.free.MAX_THOUGHTS_PER_SPACE} Thoughts per Agentic Space`} />
                <PricingFeature text={`${PLAN_CONFIG.free.AI_DAILY_LIMIT} Daily Agentic AI Interactions`} />
                <PricingFeature text={`${PLAN_CONFIG.free.MAX_STORAGE_MB}MB Cloud Storage`} />
              </div>
              <a href="https://app.cyberia.tn" className="w-full py-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all text-center">
                Get Started Free
              </a>

              <div className="mt-6 flex items-center justify-center gap-3 opacity-60">
                <Compass className="w-4 h-4 text-slate-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Free forever. No credit card required.
                </span>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
className="glass p-10 rounded-[3rem] border-[var(--accent)]/30 bg-[var(--accent)]/5 flex flex-col relative overflow-hidden hover:-translate-y-2 transition-all duration-500 group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/10 blur-[50px] rounded-full translate-x-10 -translate-y-10 group-hover:scale-150 transition-transform duration-1000" />

              <div className="absolute top-6 right-6 z-10">
                <div className="px-3 py-1 bg-[var(--accent)] text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-[var(--accent)]/20 group-hover:scale-110 transition-transform">
                  Recommended
                </div>
              </div>

              <div className="mb-8 relative z-10">
                <h3 className="text-xl font-black uppercase tracking-[0.2em] text-[var(--accent-secondary)] mb-2">Cyberia Pro</h3>
                
                {location?.isLocalPricing ? (
                  <div className="flex flex-col gap-2 mb-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest bg-[var(--accent)]/20 text-[var(--accent-secondary)] px-3 py-1 rounded-full border border-[var(--accent)]/30 w-fit">
                      Local Pricing Active
                    </span>
                    <div className="flex items-baseline gap-2 group-hover:scale-105 transition-transform origin-left duration-500">
                      <div className="text-4xl font-black text-white">{proPrice.monthly.tnd}</div>
                      <div className="text-xl text-slate-500 font-bold uppercase tracking-widest">DT / Month</div>
                    </div>
                    <div className="text-[10px] font-bold text-[var(--accent-secondary)]/60 uppercase tracking-widest">
                      Save {savingsTnd} DT Yearly — Global: ${proPrice.monthly.usd} USD
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2 group-hover:scale-105 transition-transform origin-left duration-500">
                    <div className="text-4xl font-black text-white">${proPrice.monthly.usd}</div>
                    <div className="text-xl text-slate-500 font-bold uppercase tracking-widest">/ Month</div>
                  </div>
                )}
                
                {!location?.isLocalPricing && (
                  <div className="mt-2 text-[10px] font-bold text-[var(--accent-secondary)]/60 uppercase tracking-widest">
                    Save ${savingsUsd} Yearly
                  </div>
                )}
              </div>

              <div className="space-y-4 mb-10 flex-1">
                <PricingFeature text={`${PLAN_CONFIG.pro.MAX_SPACES} Agentic Spaces`} pro />
                <PricingFeature text={`${PLAN_CONFIG.pro.MAX_THOUGHTS_PER_SPACE} Thoughts Per Agentic Space`} pro />
                <PricingFeature text={`${PLAN_CONFIG.pro.AI_DAILY_LIMIT} Daily Agentic AI Interactions`} pro />
                <PricingFeature 
                  text={`${(PLAN_CONFIG.pro.MAX_STORAGE_MB / 1024).toFixed(0)}GB Secure Cloud Storage`} pro />
                <PricingFeature text="Access to Advanced Premium Models" pro />
                <PricingFeature text="Shared Team Spaces (Coming Soon)" pro />
              </div>

              <a href="https://app.cyberia.tn/pricing" className="w-full py-5 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all text-center shadow-xl shadow-[var(--accent)]/20 active:scale-95">
                Go Pro
              </a>

<div className="mt-6 flex items-center justify-center gap-3 opacity-60">
                <Shield className="w-4 h-4 text-[var(--accent-secondary)]" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Secure local & global payments via Flouci
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="about" className="py-32 px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-4">
              Why <span style={{ color: 'var(--accent)' }}>Cyberia Workspace</span>?
            </h2>
            <p className="text-slate-400">Simple. Your brain isn't a spreadsheet.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
            >
              <h3 className="text-[14px] font-black uppercase tracking-[0.2em] text-white mb-4">The Problem</h3>
              <p className="text-sm text-[var(--text-dimmed)] leading-relaxed">
                <span className="text-white font-semibold">Spreadsheets kill creativity.</span> Your brain doesn't think in rows and columns—so why should your tools?
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
            >
              <h3 className="text-[14px] font-black uppercase tracking-[0.2em] text-white mb-4">The Physics</h3>
              <p className="text-sm text-[var(--text-dimmed)] leading-relaxed">
                Your thoughts <span className="text-white font-semibold">drift, collide, and cluster</span> like galaxies. We built a workspace that respects that.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="glass rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
            >
              <h3 className="text-[14px] font-black uppercase tracking-[0.2em] text-white mb-4">The Agentic Space</h3>
              <p className="text-sm text-[var(--text-dimmed)] leading-relaxed">
                Oracle doesn't just chat. It <span className="text-white font-semibold">lives in your space</span>, reading docs and connecting dots.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="glass rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
            >
              <h3 className="text-[14px] font-black uppercase tracking-[0.2em] text-white mb-4">The Ownership</h3>
              <p className="text-sm text-[var(--text-dimmed)] leading-relaxed">
                <span className="text-white font-semibold">Your data stays local.</span> No cloud lock-in. You own your mind.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="contact" className="py-32 px-6 relative z-10 bg-[var(--accent)]/[0.02]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
<h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-6">
              Get In <span style={{ color: 'var(--accent)' }}>Touch</span>
            </h2>
            <p className="text-slate-400 font-medium">Have questions or feedback? We'd love to hear from you.</p>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass p-10 rounded-[3rem] border-white/5"
          >
            {contactSubmitStatus === 'success' ? (
              <div className="py-16 text-center space-y-4">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto" />
                <div>
                  <p className="text-lg font-black uppercase tracking-widest text-green-400">Message Sent</p>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">We will get back to you shortly.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Name</label>
                    <input 
                      type="text" 
                      placeholder="Your Name" 
                      value={contactName} 
                      onChange={(e) => setContactName(e.target.value)} 
                      className="w-full h-14 bg-black/40 border border-white/5 rounded-2xl px-5 text-sm text-white outline-none focus:border-[var(--accent)]/50 transition-all" 
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Email</label>
                    <input 
                      type="email" 
                      required 
                      placeholder="your@email.com" 
                      value={contactEmail} 
                      onChange={(e) => setContactEmail(e.target.value)} 
                      className="w-full h-14 bg-black/40 border border-white/5 rounded-2xl px-5 text-sm text-white outline-none focus:border-[var(--accent)]/50 transition-all" 
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Message</label>
                  <textarea 
                    required 
                    value={contactMessage} 
                    onChange={(e) => setContactMessage(e.target.value)} 
                    placeholder="How can we help?" 
                    className="w-full h-32 bg-black/40 border border-white/5 rounded-2xl p-5 text-sm text-white outline-none focus:border-[var(--accent)]/50 transition-all resize-none" 
                  />
                </div>
                {contactSubmitStatus === 'error' && (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest text-center">
                    Failed to send message. Please try again.
                  </div>
                )}
                <button 
                  type="submit" 
                  disabled={isContactSubmitting || !contactMessage.trim()} 
                  className="w-full h-14 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] disabled:opacity-50 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-lg shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/40"
                >
                  {isContactSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Send Message
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </section>

      <section className="py-40 px-6 relative z-10 text-center overflow-hidden">
        <div className="max-w-3xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
<Rocket className="w-12 h-12 text-[var(--accent)] mx-auto mb-8 animate-pulse" />
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase mb-8">
              Start <span style={{ color: 'var(--accent)' }}>Now</span>
            </h2>
            <p className="text-slate-400 mb-12 font-medium">
              Join a new generation of thinkers who are mapping the future in Cyberia Workspace.
            </p>
            <a 
              href="https://app.cyberia.tn"
              className="inline-flex items-center gap-4 px-12 py-6 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.4em] transition-all shadow-[0_20px_50px_rgba(99,102,241,0.3)] hover:-translate-y-1 active:translate-y-0"
            >
              Try for Free
              <ArrowRight className="w-5 h-5" />
            </a>
          </motion.div>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-64 bg-[var(--accent)]/10 blur-[120px] rounded-full z-0" />
      </section>

      <footer className="py-20 px-6 border-t border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Cyberia Workspace" className="w-8 h-8 opacity-50" />
            <span className="font-black uppercase tracking-widest text-slate-500">Cyberia Workspace</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            <a href="https://cyberia.tn/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="https://cyberia.tn/terms" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="https://cyberia.tn/sales-conditions" className="hover:text-white transition-colors">Terms of Sale & Refund Policy</a>
            <a href="https://cyberia.tn/legal-notice" className="hover:text-white transition-colors">Legal Notice</a>
            <a href="https://cyberia.tn/contact" className="hover:text-white transition-colors">Contact</a>
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              © {new Date().getFullYear()} CYBERIA WORKSPACE
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const PricingFeature: React.FC<{ text: string; pro?: boolean }> = ({ text, pro }) => (
  <div className="flex items-center gap-3">
    <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${pro ? 'bg-[var(--accent)]/20 border-[var(--accent)]/30 text-[var(--accent-secondary)]' : 'bg-white/5 border-white/10 text-slate-500'}`}>
      <Check className="w-3 h-3" />
    </div>
    <span className={`text-[13px] font-bold uppercase tracking-widest ${pro ? 'text-slate-300' : 'text-slate-500'}`}>{text}</span>
  </div>
);

export default Homepage;
