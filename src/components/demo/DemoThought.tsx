import React from 'react';
import { FileText, Image as ImageIcon, File, Table } from 'lucide-react';

interface DemoThoughtProps {
  title: string;
  subtitle?: string;
  type?: 'text' | 'image' | 'file' | 'doc' | 'table';
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  onPointerDown?: (e: React.PointerEvent) => void;
}

const DemoThought: React.FC<DemoThoughtProps> = ({ 
  title, 
  subtitle,
  type = 'text',
  color, 
  className = '', 
  style,
  onPointerDown 
}) => (
  <div 
    className={`glass border border-[var(--glass-border)] rounded-xl p-3 flex flex-col gap-2 min-w-[130px] shadow-2xl backdrop-blur-md relative overflow-hidden select-none cursor-grab active:cursor-grabbing ${className}`}
    style={style}
    onPointerDown={onPointerDown}
  >
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[9px] font-semibold tracking-[0.15em] text-[var(--text-muted)] truncate">
          {title}
        </span>
        <div 
          className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor]" 
          style={{ color: color || 'rgba(255,255,255,0.1)', backgroundColor: 'currentColor' }} 
        />
      </div>
      {subtitle && (
        <span className="text-[8px] font-medium tracking-wider text-[var(--text-muted)]/50 truncate">
          {subtitle}
        </span>
      )}
    </div>

    {/* Content Area Based on Type */}
    <div className="flex flex-col gap-2 py-1">
      {type === 'text' && (
        <div className="space-y-1.5">
          <div className="w-full h-1 rounded-full bg-[var(--glass-border)]" />
          <div className="w-[85%] h-1 rounded-full bg-[var(--glass-border)]" />
          <div className="flex gap-1">
            <div className="w-[30%] h-1 rounded-full bg-[var(--glass-border)]" />
            <div className="w-[40%] h-1 rounded-full bg-[var(--glass-border)] opacity-30" />
          </div>
        </div>
      )}

      {type === 'image' && (
        <div className="relative w-full aspect-[4/3] rounded-lg bg-[var(--glass-border)] border border-[var(--glass-border)] overflow-hidden flex items-center justify-center group/img">
          <ImageIcon className="w-5 h-5 text-[var(--text-muted)] group-hover/img:text-[var(--text-primary)] transition-colors" />
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--glass-border)] to-transparent" />
        </div>
      )}

      {type === 'file' && (
        <div className="w-full h-10 rounded-lg bg-[var(--glass-border)] border border-[var(--glass-border)] flex items-center px-3 gap-3">
          <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center">
            <File className="w-3 h-3 text-blue-400" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="w-12 h-1 rounded-full bg-[var(--glass-border)]" />
            <div className="w-8 h-0.5 rounded-full bg-[var(--glass-border)]" />
          </div>
        </div>
      )}

      {type === 'doc' && (
        <div className="w-full h-12 rounded-lg bg-[var(--glass-border)] border border-[var(--glass-border)] flex flex-col gap-2 p-2">
          <div className="flex items-center gap-2">
            <FileText className="w-2.5 h-2.5 text-emerald-400" />
            <div className="w-16 h-1 rounded-full bg-[var(--glass-border)]" />
          </div>
          <div className="space-y-1">
            <div className="w-full h-0.5 rounded-full bg-[var(--glass-border)]" />
            <div className="w-[90%] h-0.5 rounded-full bg-[var(--glass-border)]" />
          </div>
        </div>
      )}

      {type === 'table' && (
        <div className="w-full rounded-lg bg-[var(--glass-border)] border border-[var(--glass-border)] overflow-hidden">
          <div className="grid grid-cols-3 border-b border-[var(--glass-border)] bg-[var(--glass-border)] p-1 gap-1">
            {[1,2,3].map(i => <div key={i} className="h-1 rounded-full bg-[var(--glass-border)]" />)}
          </div>
          <div className="p-1 grid grid-cols-3 gap-1">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-0.5 rounded-full bg-[var(--glass-border)]" />)}
          </div>
        </div>
      )}
    </div>

    <div className="flex items-center justify-between mt-auto pt-1 opacity-20">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-full border border-[var(--glass-border)] flex items-center justify-center">
          <div className="w-1 h-1 rounded-full bg-[var(--text-muted)]" />
        </div>
        <div className="w-8 h-1 rounded-full bg-[var(--text-muted)]" />
      </div>
      {type === 'table' && <Table className="w-2.5 h-2.5" />}
    </div>
  </div>
);

export default DemoThought;
