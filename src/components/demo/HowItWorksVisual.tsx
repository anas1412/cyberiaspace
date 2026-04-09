import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Plus, ChevronDown, Check, Orbit, FolderTree, Columns3, CalendarDays, Cpu, Cloud, WifiOff, RefreshCw, Monitor, Smartphone, Tablet } from 'lucide-react';
import DemoThought from './DemoThought';

// ─── Types ────────────────────────────────────────────────────────────────────
interface HowItWorksVisualProps {
  onStepChange?: (step: number) => void;
  startFromStep?: number;
  restartKey?: number;
  isVisible?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const STEP_DURATIONS = [9000, 10000, 13000, 12000, 11000];

const CANVAS_THOUGHTS = [
  { id: 't1', title: 'RESEARCH', type: 'doc'   as const, color: 'var(--accent)',           sx: -140, sy: -100 },
  { id: 't2', title: 'NOTES',    type: 'text'  as const, color: 'var(--accent-secondary)', sx:  130, sy:  -80 },
  { id: 't3', title: 'ESSAY_01', type: 'image' as const, color: 'var(--accent)',           sx: -100, sy:  110 },
  { id: 't4', title: 'LECTURE',  type: 'file'  as const, color: 'var(--accent-secondary)', sx:  150, sy:  120 },
];

// Initial workspace thoughts (only shown in "Workspace", disappear when switching to "Research")
const INITIAL_THOUGHTS = [
  { id: 'i1', title: 'IDEAS',    type: 'text'  as const, color: 'var(--accent)',           sx: -180, sy:   40 },
  { id: 'i2', title: 'PLANNING', type: 'doc'   as const, color: 'var(--accent-secondary)', sx:  180, sy:   60 },
  { id: 'i3', title: 'DESIGN',   type: 'image' as const, color: 'var(--accent)',           sx:  -60, sy: -150 },
  { id: 'i4', title: 'DATA',     type: 'table' as const, color: 'var(--accent-secondary)', sx:   60, sy:  160 },
  { id: 'i5', title: 'TASKS',     type: 'table' as const, color: 'var(--accent)',           sx: -200, sy: -50 },
  { id: 'i6', title: 'REVIEW',   type: 'doc'   as const, color: 'var(--accent-secondary)', sx:  200, sy: -20 },
  { id: 'i7', title: 'LINKS',    type: 'file'  as const, color: 'var(--accent)',           sx: -120, sy:  150 },
  { id: 'i8', title: 'ARCHIVE',   type: 'text'  as const, color: 'var(--accent-secondary)', sx:  120, sy:  140 },
];

const SPAWNED_THOUGHTS = [
  { id: 's1', title: 'TASKS',   type: 'table' as const, sx: -30, sy: 40 },
  { id: 's2', title: 'SUMMARY', type: 'doc'   as const, sx:  60, sy: 50 },
];

const VIEWS = [
  { id: 'spatial',   icon: Orbit,       label: 'SPATIAL'   },
  { id: 'directory', icon: FolderTree,  label: 'DIRECTORY' },
  { id: 'kanban',    icon: Columns3,    label: 'KANBAN'    },
  { id: 'calendar',  icon: CalendarDays,label: 'CALENDAR'  },
] as const;

type ViewId = typeof VIEWS[number]['id'];

// ─── Precomputed centroid (static data, never changes) ─────────────────────────
const CENTROID = (() => {
  let cx = 0, cy = 0;
  CANVAS_THOUGHTS.forEach(t => { cx += t.sx; cy += t.sy; });
  return { x: cx / CANVAS_THOUGHTS.length, y: cy / CANVAS_THOUGHTS.length };
})();

const getThoughtPos = (index: number, view: ViewId, clustering = false): { x: number; y: number; rot: number } => {
  const t = CANVAS_THOUGHTS[index];
  let x = t.sx, y = t.sy;
  
  // When clustering, slightly drift toward centroid (10-20% attraction)
  if (clustering) {
    const pull = 0.15;
    x += (CENTROID.x - t.sx) * pull;
    y += (CENTROID.y - t.sy) * pull;
  }
  
  if (view === 'spatial')    return { x, y, rot: index * 5 - 8 };
  if (view === 'directory')  return { x: -155, y: -80 + index * 55, rot: 0 };
  if (view === 'kanban') {
    const cols = [-200, 0, 200];
    const colIdx = index % 3;
    const rowIdx = Math.floor(index / 3);
    return { x: cols[colIdx], y: -80 + rowIdx * 160, rot: 0 };
  }
  // calendar - 7-column grid like DynamicViewsVisual
  if (view === 'calendar') {
    const grid = [
      { col: 1, row: 0 }, { col: 3, row: 0 }, { col: 5, row: 0 },
      { col: 0, row: 1 }, { col: 2, row: 1 }, { col: 4, row: 1 }
    ];
    const { col, row } = grid[index % grid.length];
    return { x: (col - 3) * 85, y: -120 + row * 80, rot: 0 };
  }
  return { x: 0, y: 0, rot: 0 };
};

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ─── Reduced motion check ────────────────────────────────────────────────────
const getPrefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── Main Component ────────────────────────────────────────────────────────────
const HowItWorksVisual: React.FC<HowItWorksVisualProps> = ({
  onStepChange,
  startFromStep,
  restartKey,
  isVisible = true,
}) => {
  const { t } = useTranslation();
  const [activeStep, setActiveStep]         = useState(0);
  const [activeSpace, setActiveSpace]       = useState('Workspace');
  const [spaces, setSpaces]                 = useState(['Workspace']);
  const [showDropdown, setShowDropdown]     = useState(false);
  const [showSwitcher, setShowSwitcher]     = useState(false);
  const [plusVisible, setPlusVisible]       = useState(false);
  const [plusPulse, setPlusPulse]           = useState(false);
  const [visibleThoughts, setVisibleThoughts] = useState<string[]>([]);
  const [initialVisibleThoughts, setInitialVisibleThoughts] = useState<string[]>([]);
  const [currentView, setCurrentView]       = useState<ViewId>('spatial');
  const [showViewSwitcher, setShowViewSwitcher] = useState(false);
  const [showDirSidebar, setShowDirSidebar] = useState(false);
  const [showKanbanLabels, setShowKanbanLabels] = useState(false);
  const [showCalGrid, setShowCalGrid]       = useState(false);
  const [showOracle, setShowOracle]         = useState(false);
  const [userText, setUserText]           = useState('');
  const [showUserMsg, setShowUserMsg]     = useState(false);
  const [oracleText, setOracleText]       = useState('');
  const [showOracleResponse, setShowOracleResponse] = useState(false);
  const [showCursor, setShowCursor]         = useState(false);
  const [showLinks, setShowLinks]           = useState(false);
  const [showSpawnedLinks, setShowSpawnedLinks] = useState(false);
  const [showClustering, setShowClustering] = useState(false);
  const [showSpawned, setShowSpawned]       = useState(false);
  // Step 5: Works everywhere (sync animation)
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [syncStatus, setSyncStatus]       = useState<'offline' | 'syncing' | 'synced'>('offline');
  const [showDevices, setShowDevices]     = useState(false);

  // Refs for animation control
  const mountedRef = useRef(true);
  const generationRef = useRef(0);

  // ─── Reset state (synchronous, idempotent) ─────────────────────────────────
  const resetState = useCallback(() => {
    setActiveStep(0);
    setActiveSpace('Workspace');
    setSpaces(['Workspace']);
    setShowDropdown(false);
    setShowSwitcher(false);
    setPlusVisible(false);
    setPlusPulse(false);
    setVisibleThoughts([]);
    setInitialVisibleThoughts([]);
    setCurrentView('spatial');
    setShowViewSwitcher(false);
    setShowDirSidebar(false);
    setShowKanbanLabels(false);
    setShowCalGrid(false);
    setShowOracle(false);
    setUserText('');
    setShowUserMsg(false);
    setOracleText('');
    setShowOracleResponse(false);
    setShowCursor(false);
    setShowLinks(false);
    setShowSpawnedLinks(false);
    setShowClustering(false);
    setShowSpawned(false);
    setShowSyncPanel(false);
    setSyncStatus('offline');
    setShowDevices(false);
  }, []);

  // ─── Run animation step (async, with generation check) ─────────────────────
  const runAnimationStep = useCallback(async (step: number, gen: number) => {
    // DRY guard: check if this generation has been superseded
    const cancelled = () => gen !== generationRef.current || !mountedRef.current;
    if (cancelled()) return;

    // Skip animations entirely for users who prefer reduced motion
    if (getPrefersReducedMotion()) {
      resetState();
      setActiveStep(step);
      onStepChange?.(step);
      // Show final state of each step immediately
      if (step === 1 || step === 2 || step === 3 || step === 4) {
        setVisibleThoughts(CANVAS_THOUGHTS.map(t => t.id));
      }
      return;
    }

    // CRITICAL: Reset state at start of EACH step (not just at useEffect)
    // This ensures clean state when timer auto-advances or user clicks
    resetState();
    
    // Brief delay to let React process the reset
    await sleep(20);
    if (cancelled()) return;
    
    setActiveStep(step);
    onStepChange?.(step);

    // ── Step 0: Create your space ────────────────────────────────────────────
    if (step === 0) {
      // Start with 8 initial thoughts in "Workspace"
      setInitialVisibleThoughts(INITIAL_THOUGHTS.map(t => t.id));
      
      await sleep(600);
      if (cancelled()) return;
      setShowSwitcher(true);

      await sleep(800);
      if (cancelled()) return;
      setShowDropdown(true);

      await sleep(800);
      if (cancelled()) return;
      setSpaces(['Workspace', 'Research']);

      await sleep(400);
      if (cancelled()) return;
      setActiveSpace('Research');

      // CRITICAL: Switching to new space clears the thoughts (empty workspace)
      await sleep(300);
      if (cancelled()) return;
      setInitialVisibleThoughts([]);

      await sleep(300);
      if (cancelled()) return;
      setShowDropdown(false);
    }

    // ── Step 1: Add your thoughts ────────────────────────────────────────────
    if (step === 1) {
      await sleep(400);
      if (cancelled()) return;
      setPlusVisible(true);
      setPlusPulse(true);

      await sleep(600);
      for (let i = 0; i < CANVAS_THOUGHTS.length; i++) {
        if (cancelled()) return;
        setVisibleThoughts(prev => [...prev, CANVAS_THOUGHTS[i].id]);
        await sleep(700);
      }

      await sleep(400);
      if (cancelled()) return;
      setPlusPulse(false);
      setPlusVisible(false);
    }

    // ── Step 2: Switch views ─────────────────────────────────────────────────
    if (step === 2) {
      setVisibleThoughts(CANVAS_THOUGHTS.map(t => t.id));
      
      await sleep(200);
      if (cancelled()) return;
      setShowViewSwitcher(true);

      // Spatial
      setCurrentView('spatial');
      await sleep(2200);
      if (cancelled()) return;

      // Directory
      setCurrentView('directory');
      setShowDirSidebar(true);
      await sleep(2300);
      if (cancelled()) return;

      // Kanban
      setCurrentView('kanban');
      setShowDirSidebar(false);
      setShowKanbanLabels(true);
      await sleep(2300);
      if (cancelled()) return;

      // Calendar
      setCurrentView('calendar');
      setShowKanbanLabels(false);
      setShowCalGrid(true);
      await sleep(2200);
      if (cancelled()) return;

      setShowViewSwitcher(false);
    }

    // ── Step 3: Oracle AI ────────────────────────────────────────────────────
    if (step === 3) {
      setVisibleThoughts(CANVAS_THOUGHTS.map(t => t.id));
      
      await sleep(500);
      if (cancelled()) return;
      setShowOracle(true);

      await sleep(600);
      if (cancelled()) return;
      setShowCursor(true);
      setShowUserMsg(true);

      // Typing user message
      const userMsg = 'Organize my thoughts and generate a summary and actionable tasks';
      for (let i = 0; i <= userMsg.length; i++) {
        if (cancelled()) return;
        setUserText(userMsg.slice(0, i));
        await sleep(40);
      }

      await sleep(600);
      if (cancelled()) return;
      setShowCursor(false);

      // Simulate AI thinking/processing (user msg stays on screen)
      await sleep(800);
      if (cancelled()) return;
      setShowLinks(true);

      await sleep(1200);
      if (cancelled()) return;
      setShowSpawned(true);

      await sleep(600);
      if (cancelled()) return;
      setShowSpawnedLinks(true);

      await sleep(400);
      if (cancelled()) return;
      setShowClustering(true);

      // Show Oracle response (both messages visible now)
      await sleep(600);
      if (cancelled()) return;
      setShowOracleResponse(true);

      const responseText = "I've organized your research materials and created a summary with actionable tasks. You now have a clear overview and next steps.";
      for (let i = 0; i <= responseText.length; i++) {
        if (cancelled()) return;
        setOracleText(responseText.slice(0, i));
        await sleep(30);
      }

      await sleep(2000);
      if (cancelled()) return;
      setShowUserMsg(false);
      setShowOracleResponse(false);
      setShowLinks(false);
      setShowSpawnedLinks(false);
      setShowClustering(false);
      setShowSpawned(false);
    }

    // ── Step 4: Works everywhere ─────────────────────────────────────────────────
    if (step === 4) {
      setVisibleThoughts(CANVAS_THOUGHTS.map(t => t.id));
      
      await sleep(500);
      if (cancelled()) return;
      setShowSyncPanel(true);

      await sleep(1800);
      if (cancelled()) return;
      // Switch to syncing with animation
      setSyncStatus('syncing');

      // Animated sync progress
      await sleep(1500);
      if (cancelled()) return;
      setShowDevices(true);

      await sleep(1000);
      if (cancelled()) return;
      // Complete sync
      setSyncStatus('synced');

      await sleep(2000);
      if (cancelled()) return;
      setShowSyncPanel(false);
      setShowDevices(false);
    }
  }, [onStepChange, resetState]);

  // ─── Main animation effect ─────────────────────────────────────────────────
  useEffect(() => {
    // Don't start animation until component is visible
    if (!isVisible) {
      // Reset when not visible
      mountedRef.current = true;
      resetState();
      return;
    }
    
    // IMPORTANT: Increment generation to invalidate any previous runs
    generationRef.current += 1;
    const currentGen = generationRef.current;
    
    // Reset everything immediately
    mountedRef.current = true;
    resetState();

    // Start animation after brief delay
    const timeoutId = setTimeout(async () => {
      // Double-check generation after delay (prevents race with very fast clicks)
      if (currentGen !== generationRef.current || !mountedRef.current) return;

      const startStep = startFromStep ?? 0;

      // Run first cycle from startStep
      for (let step = startStep; step < 5; step++) {
        if (currentGen !== generationRef.current || !mountedRef.current) return;
        await runAnimationStep(step, currentGen);
        await sleep(STEP_DURATIONS[step]);
      }

      // Loop forever (only if this is still the current generation)
      while (currentGen === generationRef.current && mountedRef.current) {
        for (let step = 0; step < 5; step++) {
          if (currentGen !== generationRef.current || !mountedRef.current) return;
          await runAnimationStep(step, currentGen);
          await sleep(STEP_DURATIONS[step]);
        }
      }
    }, 50);

    // Cleanup: cancel everything
    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey, isVisible]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">

      {/* Dot grid background */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, var(--accent) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Step indicator dots */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="h-1 rounded-full transition-all duration-500"
            style={{
              width: i === activeStep ? 28 : 8,
              background: i === activeStep ? 'var(--accent)' : 'var(--glass-border)',
            }}
          />
        ))}
      </div>

      {/* ── STEP 0: Space Switcher ── */}
      <AnimatePresence>
        {showSwitcher && (
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.4 }}
            className="absolute top-4 left-4 z-30"
          >
            <div className="glass backdrop-blur-xl rounded-2xl border border-[var(--glass-border)] shadow-lg">
              <div className="flex items-center gap-2 px-4 py-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                <span className="text-[11px] font-semibold tracking-wider uppercase text-[var(--text-primary)]">
                  {activeSpace}
                </span>
                <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
              </div>
            </div>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full mt-2 left-0 min-w-[210px] glass backdrop-blur-xl rounded-2xl border border-[var(--glass-border)] shadow-xl overflow-hidden"
                >
                  <div className="p-2 space-y-1">
                    {spaces.map(space => (
                      <motion.div
                        key={space}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl
                          bg-[var(--glass-bg)] border border-[var(--glass-border)]"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-[var(--text-primary)]">
                            {space}
                          </span>
                        </div>
                        {space === activeSpace && (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </motion.div>
                    ))}
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[var(--glass-border)] mt-1">
                      <div className="w-5 h-5 rounded-md bg-[var(--glass-bg)] flex items-center justify-center">
                        <Plus className="w-3 h-3 text-[var(--text-muted)]" />
                      </div>
                      <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--text-muted)]">
                        Create space
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STEP 1: Plus button ── */}
      <AnimatePresence>
        {plusVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30"
          >
            <motion.button
              animate={plusPulse ? { scale: [1, 1.15, 1] } : {}}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-contrast, #fff)',
                boxShadow: '0 4px 16px var(--accent-shadow, rgba(127,119,221,0.35))',
                border: 'none',
                cursor: 'default',
              }}
            >
              <Plus className="w-5 h-5" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STEPS 2 & 3: View Switcher ── */}
      <AnimatePresence>
        {showViewSwitcher && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-30
              flex items-center p-1.5 glass backdrop-blur-xl rounded-2xl border border-[var(--glass-border)] shadow-lg"
          >
            {VIEWS.map(v => {
              const Icon = v.icon;
              const isActive = currentView === v.id;
              return (
                <div
                  key={v.id}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-xl transition-all duration-300"
                  style={{
                    background: isActive ? 'rgba(var(--accent-rgb, 127,119,221), 0.12)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span
                    className="text-[9px] font-black uppercase tracking-widest transition-all overflow-hidden whitespace-nowrap"
                    style={{ maxWidth: isActive ? 60 : 0, opacity: isActive ? 1 : 0 }}
                  >
                    {v.label}
                  </span>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STEP 3: Oracle Chat ── */}
      <AnimatePresence>
        {(showOracle || showOracleResponse) && (
          <motion.div
            initial={{ opacity: 0, x: -36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -36 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-[200px]
              glass backdrop-blur-xl rounded-2xl border border-[var(--glass-border)] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--glass-border)]">
              <div className="w-5 h-5 rounded-md flex items-center justify-center"
                style={{ background: 'rgba(var(--accent-rgb,127,119,221),0.15)' }}>
                <Cpu className="w-3 h-3" style={{ color: 'var(--accent)' }} />
              </div>
              <span className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: 'var(--accent)' }}>
                Oracle AI
              </span>
            </div>
            <div className="px-4 py-3 space-y-3">
              {/* User message bubble */}
              <AnimatePresence>
                {showUserMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-1"
                  >
                    <span className="text-[8px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">You</span>
                    <div
                      className="rounded-xl rounded-tl-sm px-3 py-2"
                      style={{
                        background: 'var(--bg-page)',
                        border: '0.5px solid var(--glass-border)',
                      }}
                    >
                      <p className="text-[11px] text-[var(--text-primary)] font-medium leading-relaxed">
                        {userText}
                        {showCursor && (
                          <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.5, repeat: Infinity }}
                            className="inline-block w-[2px] h-[11px] ml-[1px] align-middle"
                            style={{ background: 'var(--text-primary)' }}
                          />
                        )}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Oracle response bubble */}
              <AnimatePresence>
                {showOracleResponse && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-1"
                  >
                    <span className="text-[8px] font-semibold text-[var(--accent)] uppercase tracking-wider">Oracle AI</span>
                    <div
                      className="rounded-xl rounded-tl-sm px-3 py-2"
                      style={{
                        background: 'rgba(var(--accent-rgb,127,119,221),0.1)',
                        border: '0.5px solid rgba(var(--accent-rgb,127,119,221),0.2)',
                      }}
                    >
                      <p className="text-[11px] text-[var(--text-primary)] font-medium leading-relaxed">
                        {oracleText}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STEP 5: Works Everywhere (Sync) — Compact top-right pill like AccountMenu ── */}
      <AnimatePresence>
        {showSyncPanel && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-4 right-4 z-30"
          >
            {/* Account-style pill */}
            <div className="glass backdrop-blur-xl rounded-2xl border border-[var(--glass-border)] shadow-lg flex items-center gap-2.5 px-3 h-[40px]">
              {/* Avatar placeholder with status dot */}
              <div className="relative">
                <div className="w-7 h-7 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] flex items-center justify-center">
                  <Cloud className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-page)] transition-colors duration-300 ${
                  syncStatus === 'offline' ? 'bg-slate-500' :
                  syncStatus === 'syncing' ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'
                }`} />
              </div>

              {/* Status text */}
              <AnimatePresence mode="wait">
                <motion.span
                  key={syncStatus}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="text-[11px] font-semibold tracking-wider text-[var(--text-primary)]"
                >
                  {syncStatus === 'offline' && 'Offline'}
                  {syncStatus === 'syncing' && 'Syncing'}
                  {syncStatus === 'synced' && 'Synced'}
                </motion.span>
              </AnimatePresence>

              {/* Sync spinner / check */}
              {syncStatus === 'syncing' && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <RefreshCw className="w-3 h-3 text-blue-400" />
                </motion.div>
              )}
              {syncStatus === 'synced' && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                >
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                </motion.div>
              )}
              {syncStatus === 'offline' && (
                <WifiOff className="w-3 h-3 text-slate-500" />
              )}
            </div>

            {/* Devices row — appears below pill when synced */}
            <AnimatePresence>
              {showDevices && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-2 glass backdrop-blur-xl rounded-2xl border border-[var(--glass-border)] shadow-lg px-3 py-2.5 flex items-center gap-2"
                >
                  {[
                    { Icon: Monitor, label: 'Desktop' },
                    { Icon: Smartphone, label: 'Phone' },
                    { Icon: Tablet, label: 'Tablet' },
                  ].map((device, i) => (
                    <motion.div
                      key={device.label}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.08, type: 'spring', damping: 15 }}
                      className="w-7 h-7 rounded-lg bg-[var(--bg-page)] border border-[var(--glass-border)] flex items-center justify-center"
                      title={device.label}
                    >
                      <device.Icon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    </motion.div>
                  ))}
                  <span className="text-[9px] font-semibold tracking-wider text-[var(--text-muted)] uppercase ml-1">
                    All devices
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Canvas area ── */}
      <div className="relative w-full h-full">

        {/* Connecting lines SVG (Step 3) — Star/hub pattern from usePhysics.ts */}
        <AnimatePresence>
          {showLinks && (
            <svg
              className="absolute pointer-events-none z-10"
              style={{ left: '50%', top: '50%', width: 0, height: 0, overflow: 'visible' }}
            >
              {/* Glow layer */}
              {CANVAS_THOUGHTS.map((t, i) => (
                <motion.line
                  key={`link-glow-${i}`}
                  x1={t.sx}
                  y1={t.sy}
                  x2={CENTROID.x}
                  y2={CENTROID.y}
                  stroke="var(--accent-secondary)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.4 }}
                  transition={{ duration: 0.6, delay: i * 0.1, ease: 'easeInOut' }}
                  style={{ filter: 'blur(6px)' }}
                />
              ))}
              {/* Main lines — solid, 0.5 opacity, matching usePhysics.ts stack style */}
              {CANVAS_THOUGHTS.map((t, i) => (
                <motion.line
                  key={`link-${i}`}
                  x1={t.sx}
                  y1={t.sy}
                  x2={CENTROID.x}
                  y2={CENTROID.y}
                  stroke="var(--accent-secondary)"
                  strokeWidth="1.0"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.5 }}
                  transition={{ duration: 0.6, delay: i * 0.1, ease: 'easeInOut' }}
                />
              ))}
            </svg>
          )}
        </AnimatePresence>

        {/* Spawned thought links (appear AFTER spawned thoughts appear) */}
        <AnimatePresence>
          {showSpawnedLinks && (
            <svg
              className="absolute pointer-events-none z-10"
              style={{ left: '50%', top: '50%', width: 0, height: 0, overflow: 'visible' }}
            >
              {/* Glow layer */}
              {SPAWNED_THOUGHTS.map((t, i) => (
                <motion.line
                  key={`link-spawned-glow-${i}`}
                  x1={t.sx}
                  y1={t.sy}
                  x2={CENTROID.x}
                  y2={CENTROID.y}
                  stroke="var(--accent)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.4 }}
                  transition={{ duration: 0.5, delay: i * 0.1, ease: 'easeInOut' }}
                  style={{ filter: 'blur(6px)' }}
                />
              ))}
              {/* Main lines — solid, matching stack style */}
              {SPAWNED_THOUGHTS.map((t, i) => (
                <motion.line
                  key={`link-spawned-${i}`}
                  x1={t.sx}
                  y1={t.sy}
                  x2={CENTROID.x}
                  y2={CENTROID.y}
                  stroke="var(--accent)"
                  strokeWidth="1.0"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.5 }}
                  transition={{ duration: 0.5, delay: i * 0.1, ease: 'easeInOut' }}
                />
              ))}
            </svg>
          )}
        </AnimatePresence>

        {/* Calendar grid and numbers (Step 2 — calendar view) */}
        <AnimatePresence>
          {showCalGrid && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            >
              {/* Day numbers */}
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(30)].map((_, i) => {
                  const n = i + 1;
                  const col = (n - 1) % 7;
                  const row = Math.floor((n - 1) / 7);
                  return (
                    <div
                      key={n}
                      className="absolute text-[8px] font-black text-[var(--text-muted)] tracking-tighter"
                      style={{
                        left: `calc(50% + ${(col - 2.5) * 85 - 10}px)`,
                        top: `calc(50% + ${-160 + row * 80 + 10}px)`,
                        transform: 'translate(-100%, 0)',
                      }}
                    >
                      {n}
                    </div>
                  );
                })}
              </div>
              
              {/* Grid SVG */}
              <svg viewBox="-300 -300 600 600" className="absolute inset-0 w-full h-full overflow-visible">
                {/* 8 vertical lines (7 columns) */}
                {[...Array(8)].map((_, i) => {
                  const x = (i - 3.5) * 85;
                  return (
                    <React.Fragment key={`v-${i}`}>
                      <line x1={x} y1={-160} x2={x} y2={240} stroke="var(--text-muted)" strokeOpacity="0.3" strokeWidth="3" style={{ filter: 'blur(2px)' }} />
                      <line x1={x} y1={-160} x2={x} y2={240} stroke="var(--text-muted)" strokeOpacity="0.5" strokeWidth="1" />
                    </React.Fragment>
                  );
                })}
                {/* 6 horizontal lines */}
                {[...Array(6)].map((_, i) => {
                  const y = -160 + i * 80;
                  return (
                    <React.Fragment key={`h-${i}`}>
                      <line x1={-297.5} y1={y} x2={297.5} y2={y} stroke="var(--text-muted)" strokeOpacity="0.3" strokeWidth="3" style={{ filter: 'blur(2px)' }} />
                      <line x1={-297.5} y1={y} x2={297.5} y2={y} stroke="var(--text-muted)" strokeOpacity="0.5" strokeWidth="1" />
                    </React.Fragment>
                  );
                })}
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Directory container (Step 2 — directory view) */}
        <AnimatePresence>
          {showDirSidebar && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="absolute left-3 right-3 top-14 bottom-3 glass rounded-2xl
                border border-[var(--glass-border)] overflow-hidden z-10 pointer-events-none flex"
            >
              {/* Sidebar */}
              <div className="w-[160px] flex-shrink-0 border-r border-[var(--glass-border)] flex flex-col">
                <div className="px-3 py-3 border-b border-[var(--glass-border)]">
                  <span className="text-[9px] font-black tracking-[0.2em] uppercase"
                    style={{ color: 'var(--accent)' }}>
                    Directory
                  </span>
                </div>
                {/* Group controls */}
                <div className="p-2 border-b border-[var(--glass-border)] space-y-1.5">
                  <div className="h-6 rounded-lg bg-[var(--bg-page)]/50 px-2 flex items-center">
                    <span className="text-[8px] text-[var(--text-muted)]">Stacks</span>
                  </div>
                  <div className="h-6 rounded-lg bg-[var(--bg-page)]/50 px-2 flex items-center">
                    <span className="text-[8px] text-[var(--text-muted)]">A → Z</span>
                  </div>
                </div>
                {/* List */}
                <div className="flex-1 p-2 space-y-0.5">
                  {CANVAS_THOUGHTS.slice(0, 3).map(t => (
                    <div key={t.id}
                      className="h-7 rounded-lg px-2 flex items-center gap-1.5"
                      style={{
                        background: 'rgba(var(--accent-rgb,127,119,221),0.08)',
                        border: '0.5px solid rgba(var(--accent-rgb,127,119,221),0.15)',
                      }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                      <span className="text-[10px] text-[var(--text-primary)] truncate">{t.title}</span>
                    </div>
                  ))}
                  {CANVAS_THOUGHTS.slice(3).map(t => (
                    <div key={t.id} className="h-6 rounded-lg px-2 flex items-center hover:bg-[var(--glass-bg)]">
                      <span className="text-[9px] text-[var(--text-muted)] truncate">{t.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right panel */}
              <div className="flex-1 flex flex-col">
                {/* Content Header */}
                <div className="px-4 py-3 border-b border-[var(--glass-border)] flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[var(--accent)]/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-sm bg-[var(--accent)]" />
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--text-primary)]">{CANVAS_THOUGHTS[0].title}</span>
                  <span className="text-[9px] text-[var(--text-muted)] ml-auto">doc</span>
                </div>
                {/* Content Body */}
                <div className="flex-1 p-4 space-y-2 overflow-hidden">
                  <div className="space-y-1.5">
                    <div className="h-1.5 rounded-full bg-[var(--glass-border)] w-full" />
                    <div className="h-1.5 rounded-full bg-[var(--glass-border)] w-[90%]" />
                    <div className="h-1.5 rounded-full bg-[var(--glass-border)] w-[85%]" />
                  </div>
                  <div className="mt-4 space-y-1.5">
                    <div className="h-1 rounded-full bg-[var(--glass-border)]/50 w-[70%]" />
                    <div className="h-1 rounded-full bg-[var(--glass-border)]/50 w-[60%]" />
                    <div className="h-1 rounded-full bg-[var(--glass-border)]/50 w-[75%]" />
                  </div>
                  <div className="mt-4 p-3 rounded-xl bg-[var(--bg-page)]/30 border border-[var(--glass-border)]">
                    <div className="h-1 rounded-full bg-[var(--accent)]/30 w-16 mb-2" />
                    <div className="space-y-1">
                      <div className="h-1 rounded-full bg-[var(--glass-border)]/50 w-full" />
                      <div className="h-1 rounded-full bg-[var(--glass-border)]/50 w-[90%]" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Kanban column labels (Step 2 — kanban view) */}
        <AnimatePresence>
          {showKanbanLabels && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-16 left-0 right-0 flex justify-around pointer-events-none z-10"
            >
              {[
                { label: 'TODO', x: -200 },
                { label: 'DOING', x: 0 },
                { label: 'DONE', x: 200 }
              ].map(({ label, x }) => (
                <span key={label}
                  className="absolute text-[9px] font-black tracking-[0.35em] uppercase text-[var(--text-muted)]"
                  style={{ left: `calc(50% + ${x}px)`, transform: 'translateX(-50%)' }}>
                  {label}
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* CANVAS_THOUGHTS (steps 1-4) */}
        {CANVAS_THOUGHTS.map((thought, i) => {
          const isThoughtVisible = visibleThoughts.includes(thought.id);
          // Hide thoughts in directory view - they show in the sidebar instead
          const isHiddenInDirectory = currentView === 'directory' && isThoughtVisible;
          const pos = getThoughtPos(i, currentView, showClustering);
          const scale = currentView === 'calendar' ? 0.75 : (showClustering ? 1.0 : 0.9);

          return (
            <AnimatePresence key={thought.id}>
              {isThoughtVisible && !isHiddenInDirectory && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.3, x: 0, y: 0, rotate: 0 }}
                  animate={{
                    opacity: 1,
                    scale,
                    x: pos.x,
                    y: pos.y,
                    rotate: pos.rot,
                  }}
                  exit={{ opacity: 0, scale: 0.3 }}
                  transition={{
                    type: 'spring',
                    damping: 20,
                    stiffness: 120,
                    mass: 1,
                  }}
                  className="absolute left-1/2 top-1/2 z-20"
                  style={{ originX: '50%', originY: '50%' }}
                >
                  <div style={{ transform: 'translate(-50%, -50%)' }}>
                    <DemoThought
                      title={thought.title}
                      type={thought.type}
                      color={syncStatus === 'synced' ? '#10b981' : thought.color}
                      className="shadow-2xl"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          );
        })}

        {/* INITIAL_THOUGHTS (Step 0 - only in "Workspace") */}
        {INITIAL_THOUGHTS.map((thought, i) => {
          const isThoughtVisible = initialVisibleThoughts.includes(thought.id);
          // Hide in directory view
          const isHiddenInDirectory = currentView === 'directory' && isThoughtVisible;
          
          return (
            <AnimatePresence key={thought.id}>
              {isThoughtVisible && !isHiddenInDirectory && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.3 }}
                  animate={{ opacity: 1, scale: 0.9, x: thought.sx, y: thought.sy, rotate: i * 3 - 10 }}
                  exit={{ opacity: 0, scale: 0.3 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 120 }}
                  className="absolute left-1/2 top-1/2 z-20"
                  style={{ originX: '50%', originY: '50%' }}
                >
                  <div style={{ transform: 'translate(-50%, -50%)' }}>
                    <DemoThought
                      title={thought.title}
                      type={thought.type}
                      color={thought.color}
                      className="shadow-2xl"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          );
        })}

        {/* SPAWNED_THOUGHTS (Step 3) */}
        {SPAWNED_THOUGHTS.map((thought, i) => {
          // When clustering, pull tighter toward centroid
          const clusterOffset = showClustering ? 15 : 0;
          
          return (
            <AnimatePresence key={thought.id}>
              {showSpawned && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.2, x: 0, y: 0 }}
                  animate={{ 
                    opacity: 1, 
                    scale: showClustering ? 0.95 : 0.85, 
                    x: thought.sx - clusterOffset,
                    y: thought.sy - clusterOffset,
                  }}
                  exit={{ opacity: 0, scale: 0.2 }}
                  transition={{
                    type: 'spring',
                    damping: 18,
                    stiffness: 120,
                    delay: i * 0.15,
                  }}
                  className="absolute left-1/2 top-1/2 z-20"
                >
                  <div style={{ transform: 'translate(-50%, -50%)' }}>
                    <DemoThought
                      title={thought.title}
                      type={thought.type}
                      color={syncStatus === 'synced' ? '#10b981' : 'var(--accent)'}
                      className="shadow-2xl"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          );
        })}
      </div>

      {/* Step description */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center z-30 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <h4 className="text-[14px] font-semibold text-[var(--text-primary)]">
              {t(`homepage.how_it_works.steps.${activeStep}.title`)}
            </h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              {t(`homepage.how_it_works.steps.${activeStep}.subtitle`)}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default React.memo(HowItWorksVisual);