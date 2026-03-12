import React from 'react';

interface DemoThoughtProps {
  title: string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  onPointerDown?: (e: React.PointerEvent) => void;
}

const DemoThought: React.FC<DemoThoughtProps> = ({ 
  title, 
  color, 
  className = '', 
  style,
  onPointerDown 
}) => (
  <div 
    className={`glass border border-white/5 rounded-xl p-3 flex flex-col gap-2 min-w-[120px] shadow-sm backdrop-blur-sm relative overflow-hidden select-none cursor-grab active:cursor-grabbing ${className}`}
    style={style}
    onPointerDown={onPointerDown}
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

export default DemoThought;
