import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DemoThought from './DemoThought';

const AgenticWorkspaceVisual: React.FC = () => {
  const [promptText, setPromptText] = useState("");
  const [stage, setStage] = useState<'prompt' | 'beam' | 'spawn' | 'linked' | 'settled'>('prompt');
  const fullPrompt = "Research on topic X, find me 3 related videos from youtube and link them.";

  const freeNodes = [
    { id: 'f1', title: 'RESEARCH_REF', x: [340, -340], y: [-220, 220], duration: 45, delay: 0 },
    { id: 'f2', title: 'API_DOCS', x: [-390, 390], y: [170, -170], duration: 55, delay: 10 },
    { id: 'f3', title: 'MARKET_DATA', x: [230, -230], y: [280, -280], duration: 65, delay: 5 },
    { id: 'f4', title: 'STRATEGY_V1', x: [-290, 290], y: [-340, 340], duration: 50, delay: 15 },
  ];

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return;
    let mounted = true;
    const runSequence = async () => {
      while (mounted) {
        setStage('prompt');
        setPromptText("");
        for (let i = 0; i <= fullPrompt.length; i++) {
          if (!mounted) break;
          setPromptText(fullPrompt.slice(0, i));
          await new Promise(r => setTimeout(r, 60));
        }
        if (!mounted) break;
        await new Promise(r => setTimeout(r, 600));
        setStage('beam');
        await new Promise(r => setTimeout(r, 500));
        if (!mounted) break;
        setStage('spawn');
        await new Promise(r => setTimeout(r, 800));
        if (!mounted) break;
        setStage('linked');
        await new Promise(r => setTimeout(r, 1200));
        if (!mounted) break;
        setStage('settled');
        await new Promise(r => setTimeout(r, 5000));
      }
    };
    runSequence();
    return () => { mounted = false; };
  }, []);

  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
    return null;
  }

  const cards = [
    { id: '1', title: 'YOUTUBE_01', tx: -160, ty: 40 },
    { id: '2', title: 'YOUTUBE_02', tx: 160, ty: 60 },
    { id: '3', title: 'YOUTUBE_03', tx: 0, ty: 180 },
  ];

  return (
    <div className="relative w-full h-full bg-transparent overflow-hidden pointer-events-none will-change-transform">
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, var(--accent) 1px, transparent 0)`, backgroundSize: '40px 40px' }} />
      {freeNodes.map((node) => (
        <motion.div key={node.id} className="absolute left-1/2 top-1/2" animate={{ x: node.x, y: node.y, rotate: [0, 8, -8, 0] }} transition={{ x: { duration: node.duration, repeat: Infinity, ease: "linear", delay: -node.delay }, y: { duration: node.duration * 1.1, repeat: Infinity, ease: "linear", delay: -node.delay }, rotate: { duration: 15, repeat: Infinity, ease: "easeInOut" } }}>
          <div className="-translate-x-1/2 -translate-y-1/2"><DemoThought title={node.title} className="scale-75 opacity-40" /></div>
        </motion.div>
      ))}
      <div className="absolute left-1/2 -translate-x-1/2 top-[10%] z-30">
        <motion.div className="w-[360px] h-20 glass border border-white/10 rounded-[2rem] flex items-center px-6 relative overflow-hidden shadow-2xl" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8 }}>
          <div className="flex flex-col w-full">
            <span className="text-[8px] font-black tracking-[0.4em] text-white/20 uppercase mb-1">ORACLE AI</span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-[var(--accent-secondary)] tracking-wider font-bold">
                {">"} {promptText}<motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.6, repeat: Infinity }} className="inline-block w-[6px] h-[12px] bg-[var(--accent-secondary)] ml-1 align-middle" />
              </span>
            </div>
          </div>
        </motion.div>
      </div>
      <AnimatePresence>
        {stage === 'beam' && (
          <motion.div className="absolute left-1/2 w-[2px] bg-gradient-to-b from-[var(--accent-secondary)] to-white shadow-[0_0_20px_var(--accent-secondary)] z-20" initial={{ top: '23%', height: 0, opacity: 1, translateX: '-50%' }} animate={{ height: '27%', opacity: [1, 1, 0] }} transition={{ duration: 0.5, ease: "circIn" }} />
        )}
      </AnimatePresence>
      <motion.div className="absolute inset-0 flex items-center justify-center pointer-events-none" animate={(stage === 'linked' || stage === 'settled') ? { rotate: [0, 4, -4, 0], x: [0, 40, -40, 0], y: [0, -20, 20, 0] } : {}} transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}>
        <svg viewBox="-300 -300 600 600" className="absolute inset-0 w-full h-full overflow-visible">
          {(stage === 'linked' || stage === 'settled') && [ [0, 1], [1, 2], [2, 0] ].map(([i, j]) => (
            <motion.line key={`${i}-${j}`} initial={{ pathLength: 0, x1: cards[i].tx, y1: cards[i].ty, x2: cards[j].tx, y2: cards[j].ty }} animate={{ pathLength: 1, x1: cards[i].tx * (stage === 'settled' ? 0.75 : 1), y1: cards[i].ty * (stage === 'settled' ? 0.75 : 1), x2: cards[j].tx * (stage === 'settled' ? 0.75 : 1), y2: cards[j].ty * (stage === 'settled' ? 0.75 : 1) }} transition={{ pathLength: { duration: 1.2, ease: "easeInOut" }, x1: { type: "spring", stiffness: 400, damping: 25 }, y1: { type: "spring", stiffness: 400, damping: 25 }, x2: { type: "spring", stiffness: 400, damping: 25 }, y2: { type: "spring", stiffness: 400, damping: 25 } }} stroke="#cbd5e1" strokeOpacity="0.35" strokeWidth="1" />
          ))}
        </svg>
        {(stage === 'spawn' || stage === 'linked' || stage === 'settled') && cards.map((card, i) => (
          <motion.div key={card.id} className="absolute left-1/2 top-1/2" initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }} animate={{ x: stage === 'settled' ? card.tx * 0.75 : card.tx, y: stage === 'settled' ? card.ty * 0.75 : card.ty, opacity: 1, scale: 0.9, rotate: (stage === 'linked' || stage === 'settled') ? [0, i % 2 === 0 ? 3 : -3, 0] : 0 }} transition={{ x: { type: "spring", stiffness: stage === 'settled' ? 400 : 120, damping: stage === 'settled' ? 25 : 14, delay: stage === 'spawn' ? i * 0.05 : 0 }, y: { type: "spring", stiffness: stage === 'settled' ? 400 : 120, damping: stage === 'settled' ? 25 : 14, delay: stage === 'spawn' ? i * 0.05 : 0 }, opacity: { duration: 0.3 }, scale: { type: "spring", stiffness: 200, damping: 20 }, rotate: { duration: 6 + i, repeat: Infinity, ease: "easeInOut" } }}>
            <div className="-translate-x-1/2 -translate-y-1/2"><DemoThought title={card.title} className="shadow-2xl" color="var(--accent-secondary)" /></div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

export default AgenticWorkspaceVisual;
