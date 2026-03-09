import React from 'react';
import { Table, Maximize2 } from 'lucide-react';
import { type Thought } from '../../db';
import { useThoughtPayload } from './hooks/useThoughtPayload';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TableRendererProps {
  thought: Thought;
  isReadOnly: boolean;
  setActiveFocus: (id: string, type: 'text' | 'tasks' | 'paint' | 'table' | 'embed' | 'file' | 'image') => void;

}

export const TableRenderer: React.FC<TableRendererProps> = ({ 
  thought, 
  isReadOnly, 
  setActiveFocus 
}) => {
  // Use the dual-read hook for backward compatibility
  const { table } = useThoughtPayload(thought);
  
  const isTableEmpty = !table || table.every(row => row.every(cell => !cell || !cell.trim()));
  const hasRemoteContent = thought.storageUrl && isTableEmpty && thought.syncStatus !== 'synced' && !isReadOnly;

  if (isTableEmpty) {
    return (
      <div data-trigger="table" className="mt-1 flex flex-col items-center gap-2 py-4 bg-black/20 rounded-xl border border-white/5 group/table relative cursor-pointer transition-colors hover:bg-white/[0.05]">
        <Table className="w-6 h-6 text-white/20" />
        <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
          {hasRemoteContent ? 'Sync Pending' : 'Build Table'}
        </span>
        {hasRemoteContent && (
          <p className="text-[7px] text-amber-500/40 font-black uppercase tracking-[0.2em] text-center px-4">
            Data on other device
          </p>
        )}
        {!isReadOnly && (

          <div className="absolute inset-0 bg-[var(--accent)]/10 opacity-0 group-hover/table:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
            <button
              onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'table'); }}
              className="pointer-events-auto prevent-drag bg-[var(--accent)] text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/table:scale-100 transition-all hover:scale-110 active:scale-95"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  const maxCols = 3;
  const maxRows = 4;
  const hasMoreRows = table.length > maxRows;
  const hasMoreCols = table[0]?.length > maxCols;
  const visibleRows = table.slice(0, maxRows);

  return (
    <div data-trigger="table" className="relative group/table overflow-hidden rounded-xl cursor-pointer min-h-[60px] flex flex-col justify-center">
      <div className="overflow-x-auto custom-scroll pb-1">
        <table className="thought-table mt-1 border-collapse w-full text-[10px] select-none">
          <tbody>
            {visibleRows.map((row, r) => (
              <tr key={r} className={cn(r % 2 === 0 ? "bg-white/[0.01]" : "")}>
                {row.slice(0, maxCols).map((cell, c) => (
                  <td key={c} className="p-2 border-b border-white/[0.03] text-white/60 whitespace-nowrap">
                    {cell}
                  </td>
                ))}
                {hasMoreCols && <td className="p-2 border-b border-white/[0.03] text-[8px] opacity-30">...</td>}
              </tr>
            ))}
            {hasMoreRows && (
              <tr>
                <td colSpan={Math.min(maxCols, table[0]?.length || 0) + (hasMoreCols ? 1 : 0)} className="text-center text-[8px] opacity-30 py-1">
                  ... and {table.length - maxRows} more rows
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!isReadOnly && (
        <div className="absolute inset-0 bg-[var(--accent)]/10 opacity-0 group-hover/table:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
          <button
            onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'table'); }}
            className="pointer-events-auto prevent-drag bg-[var(--accent)] text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/table:scale-100 transition-all hover:scale-110 active:scale-95"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
