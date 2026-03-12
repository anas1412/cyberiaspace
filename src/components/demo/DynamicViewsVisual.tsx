import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Orbit, Columns3, CalendarDays } from 'lucide-react';
import DemoThought from './DemoThought';

const DynamicViewsVisual: React.FC = () => {
  const [view, setView] = useState<'spatial' | 'kanban' | 'calendar'>('spatial');

  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
    return null;
  }

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
    { id: 1, title: 'ESSAY_01', color: 'var(--accent)' },
    { id: 2, title: 'LECTURE', color: 'var(--accent-secondary)' },
    { id: 3, title: 'RESEARCH', color: 'var(--accent)' },
    { id: 4, title: 'NOTES', color: 'var(--accent-secondary)' },
    { id: 5, title: 'SYNC', color: 'var(--accent)' },
    { id: 6, title: 'BACKUP', color: 'var(--accent-secondary)' },
  ];

  const freeNodes = [
    { id: 'f1', title: 'IDEAS', x: [290, -290], y: [-170, 170], duration: 30, delay: 0 },
    { id: 'f2', title: 'NOTES', x: [-230, 230], y: [110, -110], duration: 40, delay: 5 },
    { id: 'f3', title: 'LOGS', x: [170, -170], y: [230, -230], duration: 35, delay: 2 },
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
    <div className="relative w-full h-full flex items-center justify-center bg-transparent overflow-hidden pointer-events-none will-change-transform">
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-1.5 p-1.5 glass rounded-2xl border border-white/5 pointer-events-auto shadow-2xl">
        {[
          { id: 'spatial', icon: Orbit },
          { id: 'kanban', icon: Columns3 },
          { id: 'calendar', icon: CalendarDays }
        ].map((mode) => {
          const Icon = mode.icon;
          const isActive = view === mode.id;
          return (
            <button 
              key={mode.id} 
              onClick={() => setView(mode.id as any)} 
              className={`px-3 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 ${isActive ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
              title={`${mode.id} View`}
            >
              <Icon className="w-4 h-4" />
              <span className={`text-[9px] font-black uppercase tracking-widest transition-all overflow-hidden whitespace-nowrap ${isActive ? 'max-w-[60px] opacity-100' : 'max-w-0 opacity-0'}`}>
                {mode.id}
              </span>
            </button>
          );
        })}
      </div>
      <div className="absolute inset-0 opacity-[0.03]" style={{ 
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
            y: { duration: node.duration * 0.9, repeat: Infinity, ease: "linear", delay: -node.delay },
            rotate: { duration: 12, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          <div className="-translate-x-1/2 -translate-y-1/2">
            <DemoThought title={node.title} className="scale-75 opacity-40" />
          </div>
        </motion.div>
      ))}

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
            <motion.div 
              className="absolute left-1/2 top-1/2 w-[600px] h-[400px] bg-[var(--accent)]/5 rounded-full blur-[100px]"
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.2, 0.4, 0.2],
                x: '-50%',
                y: '-50%'
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(30)].map((_, i) => {
                const n = i + 1;
                const col = (n - 1) % 7;
                const row = Math.floor((n - 1) / 7);
                return (
                  <motion.div 
                    key={n}
                    className="absolute left-1/2 top-1/2 text-[8px] font-black text-white/20 tracking-tighter"
                    style={{
                      x: (col - 2.5) * 85 - 10,
                      y: -160 + row * 80 + 10,
                      translateX: '-100%'
                    }}
                  >
                    {n}
                  </motion.div>
                );
              })}
            </div>
            <svg viewBox="-300 -300 600 600" className="absolute inset-0 w-full h-full overflow-visible">
              {[...Array(8)].map((_, i) => {
                const x = (i - 3.5) * 85;
                return (
                  <React.Fragment key={`v-${i}`}>
                    <line x1={x} y1={-160} x2={x} y2={240} stroke="white" strokeOpacity="0.1" strokeWidth="3" style={{ filter: 'blur(2px)' }} />
                    <line x1={x} y1={-160} x2={x} y2={240} stroke="white" strokeOpacity="0.2" strokeWidth="1" />
                  </React.Fragment>
                );
              })}
              {[...Array(6)].map((_, i) => {
                const y = -160 + i * 80;
                return (
                  <React.Fragment key={`h-${i}`}>
                    <line x1={-297.5} y1={y} x2={297.5} y2={y} stroke="white" strokeOpacity="0.1" strokeWidth="3" style={{ filter: 'blur(2px)' }} />
                    <line x1={-297.5} y1={y} x2={297.5} y2={y} stroke="white" strokeOpacity="0.2" strokeWidth="1" />
                  </React.Fragment>
                );
              })}
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {thoughts.map((t, i) => {
        const pos = getPosition(i, view);
        return (
          <motion.div
            key={t.id}
            className="absolute left-1/2 top-1/2"
            animate={{ 
              x: pos.x, 
              y: pos.y,
              scale: view === 'calendar' ? 0.75 : 0.9,
              rotate: view === 'spatial' ? (i * 5 - 10) : 0
            }}
            transition={{ type: "spring", damping: 25, stiffness: 80, mass: 1.2 }}
          >
            <div className="-translate-x-1/2 -translate-y-1/2">
              <DemoThought title={t.title} color={t.color} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default DynamicViewsVisual;
