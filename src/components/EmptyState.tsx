import React from 'react';
import { useStore } from '../store/useStore';

const EmptyState: React.FC = () => {
  const thoughts = useStore((state) => state.thoughts);
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  if (thoughts.length > 0 || activeSpace?.mode !== 'spatial') return null;

  return (
    <div id="empty-guide" className="fixed inset-0 z-[5] pointer-events-none flex items-center justify-center opacity-100 transition-opacity duration-500">
      {/* 0. Manage Spaces (Top Left) */}
      <div className="absolute top-[110px] left-[100px] rotate-[5deg] text-center">
        <svg width="40" height="60" viewBox="0 0 50 100" className="opacity-50 block mx-auto -scale-x-100">
          <path d="M 25 100 Q 25 50 25 10 M 10 30 L 25 10 L 40 30" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
        <p className="font-['Comic_Sans_MS',_cursive] text-white/40 text-[12px] mt-[5px]">Manage Spaces</p>
      </div>

      {/* 1. Switch Spaces (Top Center) */}
      <div className="absolute top-[110px] left-1/2 -translate-x-1/2 -rotate-[2deg] text-center">
        <svg width="40" height="60" viewBox="0 0 50 100" className="opacity-50 block mx-auto">
          <path d="M 25 100 Q 25 50 25 10 M 10 30 L 25 10 L 40 30" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
        <p className="font-['Comic_Sans_MS',_cursive] text-white/40 text-[12px] mt-[5px]">Switch Spaces</p>
      </div>

      {/* 2. Create Thought (Top Right - Inner) */}
      <div className="absolute top-[110px] right-[230px] rotate-[5deg] text-center">
        <svg width="40" height="60" viewBox="0 0 50 100" className="opacity-50 block mx-auto rotate-[15deg]">
          <path d="M 25 100 Q 25 50 25 10 M 10 30 L 25 10 L 40 30" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
        <p className="font-['Comic_Sans_MS',_cursive] text-white/40 text-[12px] mt-[5px]">Create Thought</p>
      </div>

      {/* 3. Change Perspective (Top Right - Outer) */}
      <div className="absolute top-[110px] right-[50px] -rotate-[5deg] text-center">
        <svg width="40" height="60" viewBox="0 0 50 100" className="opacity-50 block mx-auto">
          <path d="M 25 100 Q 25 50 25 10 M 10 30 L 25 10 L 40 30" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
        <p className="font-['Comic_Sans_MS',_cursive] text-white/40 text-[12px] mt-[5px]">Change Perspective</p>
      </div>

      {/* 4. Manage Data (Bottom Center) */}
      <div className="absolute bottom-[110px] left-1/2 -translate-x-1/2 rotate-[2deg] text-center">
        <p className="font-['Comic_Sans_MS',_cursive] text-white/40 text-[12px] mb-[5px]">Manage Data</p>
        <svg width="40" height="60" viewBox="0 0 50 100" className="opacity-50 block mx-auto">
          <path d="M 25 0 Q 25 50 25 90 M 10 70 L 25 90 L 40 70" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </div>

      {/* Center Text */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <h2 className="font-['Comic_Sans_MS',_cursive] text-white/10 text-[32px] tracking-[4px] font-bold">YOUR MIND IS EMPTY</h2>
        <p className="font-['Comic_Sans_MS',_cursive] text-white/10 text-[12px] mt-[10px]">(For now...)</p>
        
        {/* Paste Hint */}
        <div className="mt-[40px] px-5 py-2.5 bg-white/[0.02] border border-dashed border-white/[0.05] rounded-[20px] inline-block">
          <p className="font-['Comic_Sans_MS',_cursive] text-white/30 text-[11px] tracking-[1px] uppercase">
            <span className="bg-white/10 px-1.5 py-0.5 rounded-[4px] mr-1">Ctrl + V</span> 
            Paste text or images to spawn thoughts instantly
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmptyState;
