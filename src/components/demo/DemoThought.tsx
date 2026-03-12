import React from 'react';
import { FileText, Image as ImageIcon, File, Table } from 'lucide-react';

interface DemoThoughtProps {
  title: string;
  type?: 'text' | 'image' | 'file' | 'doc' | 'table';
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  onPointerDown?: (e: React.PointerEvent) => void;
}

const DemoThought: React.FC<DemoThoughtProps> = ({ 
  title, 
  type = 'text',
  color, 
  className = '', 
  style,
  onPointerDown 
}) => (
  <div 
    className={`glass border border-white/10 rounded-xl p-3 flex flex-col gap-2 min-w-[130px] shadow-2xl backdrop-blur-md relative overflow-hidden select-none cursor-grab active:cursor-grabbing ${className}`}
    style={style}
    onPointerDown={onPointerDown}
  >
    <div className="flex items-center justify-between gap-4">
      <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/40 truncate">
        {title}
      </span>
      <div 
        className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor]" 
        style={{ color: color || 'rgba(255,255,255,0.1)', backgroundColor: 'currentColor' }} 
      />
    </div>

    {/* Content Area Based on Type */}
    <div className="flex flex-col gap-2 py-1">
      {type === 'text' && (
        <div className="space-y-1.5">
          <div className="w-full h-1 rounded-full bg-white/5" />
          <div className="w-[85%] h-1 rounded-full bg-white/5" />
          <div className="flex gap-1">
            <div className="w-[30%] h-1 rounded-full bg-white/5" />
            <div className="w-[40%] h-1 rounded-full bg-white/5 opacity-30" />
          </div>
        </div>
      )}

      {type === 'image' && (
        <div className="relative w-full aspect-[4/3] rounded-lg bg-white/5 border border-white/5 overflow-hidden flex items-center justify-center group/img">
          <ImageIcon className="w-5 h-5 text-white/10 group-hover/img:text-white/20 transition-colors" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
        </div>
      )}

      {type === 'file' && (
        <div className="w-full h-10 rounded-lg bg-white/5 border border-white/5 flex items-center px-3 gap-3">
          <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center">
            <File className="w-3 h-3 text-blue-400" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="w-12 h-1 rounded-full bg-white/10" />
            <div className="w-8 h-0.5 rounded-full bg-white/5" />
          </div>
        </div>
      )}

      {type === 'doc' && (
        <div className="w-full h-12 rounded-lg bg-white/5 border border-white/5 flex flex-col gap-2 p-2">
          <div className="flex items-center gap-2">
            <FileText className="w-2.5 h-2.5 text-emerald-400" />
            <div className="w-16 h-1 rounded-full bg-white/10" />
          </div>
          <div className="space-y-1">
            <div className="w-full h-0.5 rounded-full bg-white/5" />
            <div className="w-[90%] h-0.5 rounded-full bg-white/5" />
          </div>
        </div>
      )}

      {type === 'table' && (
        <div className="w-full rounded-lg bg-white/5 border border-white/5 overflow-hidden">
          <div className="grid grid-cols-3 border-b border-white/5 bg-white/5 p-1 gap-1">
            {[1,2,3].map(i => <div key={i} className="h-1 rounded-full bg-white/10" />)}
          </div>
          <div className="p-1 grid grid-cols-3 gap-1">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-0.5 rounded-full bg-white/5" />)}
          </div>
        </div>
      )}
    </div>

    <div className="flex items-center justify-between mt-auto pt-1 opacity-20">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full border border-white/40 flex items-center justify-center">
          <div className="w-1 h-1 rounded-full bg-white/40" />
        </div>
        <div className="w-8 h-1 rounded-full bg-white/40" />
      </div>
      {type === 'table' && <Table className="w-2.5 h-2.5" />}
    </div>
  </div>
);

export default DemoThought;
