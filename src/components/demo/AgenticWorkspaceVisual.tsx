import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DemoThought from './DemoThought';

const MENTION_TOPICS = [
  { id: 'ww2', label: 'World War 2', desc: '1939–1945 · Global conflict', icon: '' },
  { id: 'ww1', label: 'World War 1', desc: '1914–1918 · Western Front', icon: '' },
  { id: 'cold', label: 'Cold War', desc: '1947–1991 · Geopolitical tension', icon: '' },
];

interface AgenticWorkspaceVisualProps {
  showLinked?: boolean;
}

const AgenticWorkspaceVisual: React.FC<AgenticWorkspaceVisualProps> = ({ showLinked = false }) => {
  const [promptSegments, setPromptSegments] = useState<{ type: 'text' | 'mention'; value: string }[]>([]);
  const [stage, setStage] = useState<'prompt' | 'beam' | 'spawn' | 'linked' | 'settled'>(showLinked ? 'settled' : 'prompt');
  const [showDropup, setShowDropup] = useState(false);
  const [activeDropupItem] = useState(0);

  const PROMPT_PRE = 'Find me 3 videos about ';
  const PROMPT_POST = '.';
  const MENTION = 'World War 2';

  const freeNodes = [
    { id: 'f1', title: 'RESEARCH_REF', x: [340, -340], y: [-220, 220], duration: 45, delay: 0 },
    { id: 'f2', title: 'API_DOCS', x: [-390, 390], y: [170, -170], duration: 55, delay: 10 },
    { id: 'f3', title: 'MARKET_DATA', x: [230, -230], y: [280, -280], duration: 65, delay: 5 },
    { id: 'f4', title: 'STRATEGY_V1', x: [-290, 290], y: [-340, 340], duration: 50, delay: 15 },
  ];

  const cards = [
    { id: '1', title: 'YOUTUBE_01', subtitle: 'D-Day · June 1944',    tx: -160, ty: 40 },
    { id: '2', title: 'YOUTUBE_02', subtitle: 'Battle of Britain',     tx: 160,  ty: 60 },
    { id: '3', title: 'YOUTUBE_03', subtitle: 'Fall of Berlin · 1945', tx: 0,    ty: 180 },
  ];

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return;
    
    // If showLinked is true, skip animation and go to settled state
    if (showLinked) {
      setStage('settled');
      return;
    }
    
    let mounted = true;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    const runSequence = async () => {
      while (mounted) {
        // ── Reset ──────────────────────────────────────────────
        setStage('prompt');
        setShowDropup(false);
        setPromptSegments([]);
        await sleep(400);

        // ── Type prefix ────────────────────────────────────────
        for (let i = 0; i <= PROMPT_PRE.length; i++) {
          if (!mounted) break;
          setPromptSegments([{ type: 'text', value: PROMPT_PRE.slice(0, i) }]);
          await sleep(55);
        }

        // ── Show @ + dropup ────────────────────────────────────
        if (!mounted) break;
        setShowDropup(true);
        setPromptSegments([{ type: 'text', value: PROMPT_PRE }, { type: 'text', value: '@' }]);
        await sleep(300);

        // ── Type mention chars ─────────────────────────────────
        let typed = '';
        for (const ch of MENTION) {
          if (!mounted) break;
          typed += ch;
          setPromptSegments([
            { type: 'text', value: PROMPT_PRE },
            { type: 'text', value: '@' + typed },
          ]);
          await sleep(80);
        }
        await sleep(500);

        // ── Collapse to mention tag ────────────────────────────
        if (!mounted) break;
        setShowDropup(false);
        setPromptSegments([
          { type: 'text', value: PROMPT_PRE },
          { type: 'mention', value: '@' + MENTION },
          { type: 'text', value: ' ' },
        ]);
        await sleep(300);

        // ── Type suffix ────────────────────────────────────────
        for (let i = 0; i <= PROMPT_POST.length; i++) {
          if (!mounted) break;
          setPromptSegments([
            { type: 'text', value: PROMPT_PRE },
            { type: 'mention', value: '@' + MENTION },
            { type: 'text', value: ' ' + PROMPT_POST.slice(0, i) },
          ]);
          await sleep(45);
        }

        await sleep(700);
        if (!mounted) break;

        // ── Stages (unchanged from original) ──────────────────
        setStage('beam');
        await sleep(500);
        if (!mounted) break;
        setStage('spawn');
        await sleep(800);
        if (!mounted) break;
        setStage('linked');
        await sleep(1200);
        if (!mounted) break;
        setStage('settled');
        await sleep(5000);
      }
    };

    runSequence();
    return () => { mounted = false; };
  }, [showLinked]);

  if (typeof window !== 'undefined' && window.innerWidth < 1024) return null;

  return (
    <div className="relative w-full h-full bg-transparent overflow-hidden pointer-events-none will-change-transform">
      {/* Dot grid — unchanged */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, var(--accent) 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Free floating nodes — opacity bumped 40→60 for dark bg visibility */}
      {freeNodes.map((node) => (
        <motion.div
          key={node.id}
          className="absolute left-1/2 top-1/2"
          animate={{ x: node.x, y: node.y, rotate: [0, 8, -8, 0] }}
          transition={{
            x: { duration: node.duration, repeat: Infinity, ease: 'linear', delay: -node.delay },
            y: { duration: node.duration * 1.1, repeat: Infinity, ease: 'linear', delay: -node.delay },
            rotate: { duration: 15, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <div className="-translate-x-1/2 -translate-y-1/2">
            <DemoThought title={node.title} className="scale-75 opacity-60" />
          </div>
        </motion.div>
      ))}

      {/* Prompt bar */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[10%] z-30">
        <motion.div
          className="w-[400px] glass border border-[var(--glass-border)] rounded-[2rem] px-6 py-4 relative shadow-2xl"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
          style={{ boxShadow: '0 0 40px color-mix(in srgb, var(--accent) 12%, transparent), inset 0 1px 0 var(--glass-border)' }}
        >
          <span className="text-[8px] font-black tracking-[0.4em] text-[var(--text-muted)] uppercase block mb-2">
            ORACLE AI
          </span>

          {/* Inline prompt with mention tag */}
          <div className="flex items-center flex-nowrap whitespace-nowrap gap-x-1 min-h-[18px] overflow-hidden">
            <span className="text-[11px] font-mono font-bold" style={{ color: 'var(--accent-secondary)' }}>
              {'>'}
            </span>
            {promptSegments.map((seg, i) =>
              seg.type === 'mention' ? (
                <span
                  key={i}
                  className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    background: 'color-mix(in srgb, var(--accent-secondary) 15%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--accent-secondary) 40%, transparent)',
                    color: 'var(--accent-secondary)',
                  }}
                >
                  {seg.value}
                </span>
              ) : (
                <span
                  key={i}
                  className="text-[11px] font-mono tracking-wider font-bold shrink-0"
                  style={{ color: 'var(--accent-secondary)' }}
                >
                  {seg.value}
                </span>
              )
            )}
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="inline-block w-[6px] h-[12px] align-middle ml-0.5 shrink-0"
              style={{ background: 'var(--accent-secondary)' }}
            />
          </div>

          {/* Dropdown — appears below the bar when typing @ */}
          <AnimatePresence>
            {showDropup && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="absolute left-1/2 -translate-x-1/2 pointer-events-auto overflow-hidden"
                style={{
                  top: 'calc(100% + 10px)',
                  width: 280,
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 12,
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 8px 32px color-mix(in srgb, var(--bg-page) 50%, transparent)',
                  zIndex: 50,
                }}
              >
                <div
                  className="text-[9px] font-bold tracking-[0.3em] uppercase px-3 py-2"
                  style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--glass-border)' }}
                >
                  THOUGHTS
                </div>
                {MENTION_TOPICS.map((topic, i) => (
                  <div
                    key={topic.id}
                    className="flex items-center gap-2.5 px-3 py-2.5"
                    style={{ background: i === activeDropupItem ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium truncate uppercase tracking-widest text-[var(--text-primary)]">
                        {topic.label}
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Beam — identical to original */}
      <AnimatePresence>
        {stage === 'beam' && (
          <motion.div
            className="absolute left-1/2 w-[2px] z-20"
            style={{
              background: 'linear-gradient(to bottom, var(--accent-secondary), var(--text-primary))',
              boxShadow: '0 0 20px var(--accent-secondary)',
            }}
            initial={{ top: '23%', height: 0, opacity: 1, translateX: '-50%' }}
            animate={{ height: '27%', opacity: [1, 1, 0] }}
            transition={{ duration: 0.5, ease: 'circIn' }}
          />
        )}
      </AnimatePresence>

      {/* Cards + connectors — identical structure to original */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        animate={
          stage === 'linked' || stage === 'settled'
            ? { rotate: [0, 4, -4, 0], x: [0, 40, -40, 0], y: [0, -20, 20, 0] }
            : {}
        }
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg viewBox="-300 -300 600 600" className="absolute inset-0 w-full h-full overflow-visible">
          {(stage === 'linked' || stage === 'settled') &&
            ([[0, 1], [1, 2], [2, 0]] as [number, number][]).map(([i, j]) => (
              <motion.line
                key={`${i}-${j}`}
                initial={{ pathLength: 0, x1: cards[i].tx, y1: cards[i].ty, x2: cards[j].tx, y2: cards[j].ty }}
                animate={{
                  pathLength: 1,
                  x1: cards[i].tx * (stage === 'settled' ? 0.75 : 1),
                  y1: cards[i].ty * (stage === 'settled' ? 0.75 : 1),
                  x2: cards[j].tx * (stage === 'settled' ? 0.75 : 1),
                  y2: cards[j].ty * (stage === 'settled' ? 0.75 : 1),
                }}
                transition={{
                  pathLength: { duration: 1.2, ease: 'easeInOut' },
                  x1: { type: 'spring', stiffness: 400, damping: 25 },
                  y1: { type: 'spring', stiffness: 400, damping: 25 },
                  x2: { type: 'spring', stiffness: 400, damping: 25 },
                  y2: { type: 'spring', stiffness: 400, damping: 25 },
                }}
                stroke="color-mix(in srgb, var(--accent-secondary) 45%, transparent)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))}
        </svg>

        {(stage === 'spawn' || stage === 'linked' || stage === 'settled') &&
          cards.map((card, i) => (
            <motion.div
              key={card.id}
              className="absolute left-1/2 top-1/2"
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
              animate={{
                x: stage === 'settled' ? card.tx * 0.75 : card.tx,
                y: stage === 'settled' ? card.ty * 0.75 : card.ty,
                opacity: 1,
                scale: 0.9,
                rotate:
                  stage === 'linked' || stage === 'settled'
                    ? [0, i % 2 === 0 ? 3 : -3, 0]
                    : 0,
              }}
              transition={{
                x: { type: 'spring', stiffness: stage === 'settled' ? 400 : 120, damping: stage === 'settled' ? 25 : 14, delay: stage === 'spawn' ? i * 0.05 : 0 },
                y: { type: 'spring', stiffness: stage === 'settled' ? 400 : 120, damping: stage === 'settled' ? 25 : 14, delay: stage === 'spawn' ? i * 0.05 : 0 },
                opacity: { duration: 0.3 },
                scale: { type: 'spring', stiffness: 200, damping: 20 },
                rotate: { duration: 6 + i, repeat: Infinity, ease: 'easeInOut' },
              }}
            >
              <div className="-translate-x-1/2 -translate-y-1/2">
                <DemoThought
                  title={card.title}
                  subtitle={card.subtitle}
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

export default AgenticWorkspaceVisual;