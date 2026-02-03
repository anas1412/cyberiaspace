import React from 'react';
import { useStore } from '../store/useStore';
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

const EmptyState: React.FC = () => {
  const thoughts = useStore((state) => state.thoughts);
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  if (thoughts.length > 0 || activeSpace?.mode !== 'spatial') return null;

  return (
    <div id="empty-guide" className="fixed inset-0 z-[5] pointer-events-none flex items-center justify-center">
      {/* 0. Manage Spaces (Top Left) - Hidden on Mobile */}
      <div className="hidden md:flex absolute top-[110px] left-[100px] rotate-[5deg] text-center flex-col items-center">
        <ChalkArrow d="M 30 70 Q 30 40 30 10 M 15 30 L 30 10 L 45 30" />
        <p className="font-['Comic_Sans_MS',_cursive] text-white/30 text-[12px] mt-2">Space Settings</p>
      </div>

      {/* 1. Switch Spaces (Top Center) */}
      <div className="absolute top-[80px] md:top-[110px] left-1/2 -translate-x-1/2 -rotate-[2deg] text-center flex flex-col items-center">
        <ChalkArrow d="M 30 70 Q 30 40 30 10 M 15 30 L 30 10 L 45 30" />
        <p className="font-['Comic_Sans_MS',_cursive] text-white/30 text-[10px] md:text-[12px] mt-2">Switch Spaces</p>
      </div>

      {/* 2. Create Thought (Bottom Center - The FAB) */}
      <div className="absolute bottom-[130px] md:bottom-[140px] left-1/2 -translate-x-1/2 rotate-[5deg] text-center flex flex-col items-center">
        <p className="font-['Comic_Sans_MS',_cursive] text-white/30 text-[12px] md:text-[14px] mb-2 font-bold tracking-widest uppercase">Start Here</p>
        <ChalkArrow d="M 30 10 Q 30 40 30 70 M 15 50 L 30 70 L 45 50" />
      </div>

      {/* 3. Perspective (Top Right) - Hidden on Mobile */}
      <div className="hidden md:flex absolute top-[110px] right-[50px] -rotate-[5deg] text-center flex-col items-center">
        <ChalkArrow d="M 30 70 Q 30 40 30 10 M 15 30 L 30 10 L 45 30" />
        <p className="font-['Comic_Sans_MS',_cursive] text-white/30 text-[12px] mt-2">Change Perspective</p>
      </div>

      {/* 4. Tools (Bottom Right) - Hidden on Mobile */}
      <div className="hidden md:flex absolute bottom-[140px] right-[100px] -rotate-[10deg] text-center flex-col items-center">
        <p className="font-['Comic_Sans_MS',_cursive] text-white/30 text-[12px] mb-2">Systems & Tools</p>
        <ChalkArrow d="M 30 10 Q 30 40 30 70 M 15 50 L 30 70 L 45 50" />
      </div>

      {/* Center Text */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center w-full px-10">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 0.15, y: 0 }}
          className="font-['Comic_Sans_MS',_cursive] text-white text-[32px] md:text-[48px] tracking-[4px] md:tracking-[8px] font-bold"
        >
          OPEN YOUR MIND
        </motion.h2>
        
        {/* Paste Hint - Hidden on Mobile */}
        {!isMobile && (
          <div className="mt-8 px-6 py-3 bg-white/[0.02] border border-dashed border-white/[0.05] rounded-[24px] inline-block">
            <p className="font-['Comic_Sans_MS',_cursive] text-white/30 text-[12px] tracking-[1px] uppercase">
              <span className="bg-white/10 px-2 py-1 rounded-[6px] mr-2 text-white/60">Ctrl + V</span> 
              Paste anything to create a thought instantly
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmptyState;