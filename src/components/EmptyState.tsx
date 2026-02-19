import React from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { motion } from 'framer-motion';

const ChalkArrow = ({ d, className }: { d: string, className?: string }) => (
  <svg width="60" height="80" viewBox="0 0 60 80" className={className}>
    <motion.path
      d={d}
      stroke="white"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 0.3 }}
      transition={{ duration: 2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
    />
  </svg>
);

const PHRASES = [
  "WHERE IDEAS BEGIN",
  "READY WHEN YOU ARE",
  "MAP YOUR THOUGHTS",
  "ORGANIZE YOUR WORLD",
  "THINK IN 3D",
  "FREE YOUR THOUGHTS",
  "DROP A THOUGHT",
  "CREATE SOMETHING NEW",
  "THE CANVAS IS YOURS",
  "DESIGN THE FLOW",
  "BUILD YOUR BRAIN",
  "A SPACE FOR FOCUS",
  "SPATIAL DRAFT ACTIVE",
  "START THE CONSTRUCT",
  "YOUR MIND, SPATIALIZED",
  "PLANT A SEED",
  "VOID READY FOR INPUT",
  "ZEN MODE INITIALIZED"
];

const EmptyState: React.FC = () => {
  const thoughts = useStore((state) => state.thoughts);
  const isSpaceLoading = useStore((state) => state.isSpaceLoading);
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const isReadOnly = useStore((state) => state.isReadOnly);
  const { user } = useAuthStore();

  const [randomPhrase, setRandomPhrase] = React.useState("");

  React.useEffect(() => {
    setRandomPhrase(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
  }, [activeSpaceId]);

  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  if (isSpaceLoading || thoughts.length > 0 || activeSpace?.mode !== 'spatial') return null;

  // Read-only empty state (published space with no thoughts)
  if (isReadOnly) {
    return (
      <div className="fixed inset-0 z-[5] pointer-events-none flex items-center justify-center">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 0.2, scale: 1 }}
            className="mb-6"
          >
            <svg width="120" height="120" viewBox="0 0 120 120" className="mx-auto">
              <circle cx="60" cy="60" r="50" stroke="white" strokeWidth="2" fill="none" opacity="0.1" />
              <circle cx="60" cy="60" r="30" stroke="white" strokeWidth="2" fill="none" opacity="0.1" />
              <circle cx="60" cy="60" r="10" stroke="white" strokeWidth="2" fill="none" opacity="0.1" />
            </svg>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 0.15, y: 0 }}
            className="font-['CyberiaBlueprint',_cursive,_sans-serif] text-white text-[32px] md:text-[48px] tracking-[4px] md:tracking-[8px] font-bold"
          >
            THIS SPACE IS EMPTY
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
            transition={{ delay: 0.3 }}
            className="font-['CyberiaBlueprint',_cursive,_sans-serif] text-white/40 text-[14px] md:text-[16px] mt-4 tracking-[2px] uppercase"
          >
            No thoughts have been published yet
          </motion.p>
        </div>
      </div>
    );
  }

  return (
    <div id="empty-guide" className="fixed inset-0 z-[5] pointer-events-none flex items-center justify-center">

      {/* 1. Switch Spaces (Top Center) - Points to Space Switcher */}
      <div className="absolute top-[80px] md:top-[95px] left-1/2 -translate-x-1/2 rotate-[1deg] text-center flex flex-col items-center">
        <ChalkArrow d="M 30 70 L 30 10 M 15 30 L 30 10 L 45 30" />
        <p className="font-['CyberiaBlueprint',_cursive,_sans-serif] text-white/30 text-[10px] md:text-[12px] mt-2 tracking-widest uppercase">Switch Spaces</p>
      </div>

      {/* 2. Create Thought (Bottom Center - The FAB) */}
      <div className="absolute bottom-[110px] md:bottom-[130px] left-1/2 -translate-x-1/2 -rotate-[2deg] text-center flex flex-col items-center">
        <p className="font-['CyberiaBlueprint',_cursive,_sans-serif] text-white/30 text-[12px] md:text-[14px] mb-2 font-bold tracking-widest uppercase">New Thought</p>
        <ChalkArrow d="M 30 10 L 30 70 M 15 50 L 30 70 L 45 50" />
      </div>

      {/* 3. View Modes (Top Right) - Points to View Switcher (Modes) */}
      <div className="hidden md:flex absolute top-[95px] right-[240px] -rotate-[3deg] text-center flex flex-col items-center">
        <ChalkArrow d="M 30 70 L 30 10 M 15 30 L 30 10 L 45 30" />
        <p className="font-['CyberiaBlueprint',_cursive,_sans-serif] text-white/30 text-[12px] mt-2 tracking-widest uppercase">View Modes</p>
      </div>

      {/* 4. Account (Top Right) - Points to AccountMenu */}
      <div className="hidden md:flex absolute top-[95px] right-[35px] rotate-[3deg] text-center flex flex-col items-center">
        <ChalkArrow d="M 30 70 L 30 10 M 15 30 L 30 10 L 45 30" />
        <p className="font-['CyberiaBlueprint',_cursive,_sans-serif] text-white/30 text-[12px] mt-2 tracking-widest uppercase">{user ? 'Account' : 'Login / Sync'}</p>
      </div>

      {/* 5. AI Assistant (Bottom Right) - Points to Chat/Oracle button */}
      <div className="hidden md:flex absolute bottom-[130px] right-[260px] rotate-[5deg] text-center flex flex-col items-center">
        <p className="font-['CyberiaBlueprint',_cursive,_sans-serif] text-white/30 text-[12px] mb-2 tracking-widest uppercase">AI Assistant</p>
        <ChalkArrow d="M 30 10 L 30 70 M 15 50 L 30 70 L 45 50" />
      </div>

      {/* 6. Settings (Bottom Right) - Points to System Menu button */}
      <div className="hidden md:flex absolute bottom-[130px] right-[35px] -rotate-[3deg] text-center flex flex-col items-center">
        <p className="font-['CyberiaBlueprint',_cursive,_sans-serif] text-white/30 text-[12px] mb-2 tracking-widest uppercase">Settings</p>
        <ChalkArrow d="M 30 10 L 30 70 M 15 50 L 30 70 L 45 50" />
      </div>

      {/* 7. Controls (Bottom Left) - Points to Status/Zoom controls */}
      <div className="hidden md:flex absolute bottom-[130px] left-[320px] rotate-[3deg] text-center flex flex-col items-center">
        <p className="font-['CyberiaBlueprint',_cursive,_sans-serif] text-white/30 text-[12px] mb-2 tracking-widest uppercase">Controls</p>
        <ChalkArrow d="M 30 10 L 30 70 M 15 50 L 30 70 L 45 50" />
      </div>

      {/* Center Text */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center w-full px-10">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 0.15, y: 0 }}
          className="font-['CyberiaBlueprint',_cursive,_sans-serif] text-white text-[32px] md:text-[48px] tracking-[4px] md:tracking-[8px] font-bold"
        >
          {randomPhrase}
        </motion.h2>

        {/* Unified Hint - Hidden on Mobile */}
        {!isMobile && (
          <div className="mt-10 flex items-center justify-center">
            <div className="px-8 py-4 bg-white/[0.02] border border-white/0.05 rounded-[32px] flex items-center gap-6 backdrop-blur-sm shadow-2xl">
              <div className="flex items-center gap-3">
                <kbd className="bg-white/10 px-2.5 py-1 rounded-[8px] text-[10px] text-white/60 font-mono border border-white/5 shadow-inner">SPACE</kbd>
                <p className="font-['CyberiaBlueprint',_cursive,_sans-serif] text-white/30 text-[12px] tracking-[1px] uppercase">New Thought</p>
              </div>

              <span className="text-[9px] font-black text-white/5 uppercase tracking-widest">•</span>

              <div className="flex items-center gap-3">
                <kbd className="bg-white/10 px-2.5 py-1 rounded-[8px] text-[10px] text-white/60 font-mono border border-white/5 shadow-inner">CTRL+V</kbd>
                <p className="font-['CyberiaBlueprint',_cursive,_sans-serif] text-white/30 text-[12px] tracking-[1px] uppercase">Images & Links</p>
              </div>

              <span className="text-[9px] font-black text-white/5 uppercase tracking-widest">•</span>

              <div className="flex items-center gap-3">
                <kbd className="bg-white/10 px-2.5 py-1 rounded-[8px] text-[10px] text-white/60 font-mono border border-white/5 shadow-inner">DRAG</kbd>
                <p className="font-['CyberiaBlueprint',_cursive,_sans-serif] text-white/30 text-[12px] tracking-[1px] uppercase">Images, TXT, CSV</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
