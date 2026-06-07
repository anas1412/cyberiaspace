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
  isArchived?: boolean;
  setActiveFocus: (id: string, type: 'text' | 'tasks' | 'paint' | 'table' | 'embed' | 'file' | 'image') => void;
}

export const TableRenderer: React.FC<TableRendererProps> = ({ 
  thought, 
  isReadOnly,
  isArchived = false,
  setActiveFocus 
}) => {
  // Use the dual-read hook for backward compatibility
  const { table } = useThoughtPayload(thought);
  
  const isTableEmpty = !table || table.every(row => row.every(cell => !cell || !cell.trim()));
  const hasRemoteContent = false;

  if (isTableEmpty) {
    return (
      <div data-trigger="table" className={cn(
        "mt-1 flex flex-col items-center gap-2 py-4 bg-[var(--node-bg)]/20 rounded-xl border border-[var(--glass-border)] group/table relative cursor-pointer transition-colors",
        !isArchived && "hover:bg-[var(--node-bg)]/40",
        isArchived && "pointer-events-none"
      )}>
        <Table className="w-6 h-6 text-[var(--text-muted)]" />
        <span className="text-[10px] text-[var(--text-muted)] font-medium tracking-widest">
          {hasRemoteContent ? 'Sync Pending' : 'Build Table'}
        </span>
        {hasRemoteContent && (
          <p className="text-[7px] text-[var(--accent)]/40 font-semibold tracking-[0.2em] text-center px-4">
            Data on other device
          </p>
        )}
        {!isReadOnly && !isArchived && (
          <div className="absolute inset-0 bg-[var(--accent)]/10 opacity-0 group-hover/table:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
            <button
              onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'table'); }}
              className="pointer-events-auto prevent-drag bg-[var(--accent)] text-[var(--accent-contrast)] p-2 rounded-lg shadow-xl transform scale-90 group-hover/table:scale-100 transition-all hover:scale-110 active:scale-95"
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
    <div data-trigger="table" className={cn(
      "relative group/table overflow-hidden rounded-xl cursor-pointer min-h-[60px] flex flex-col justify-center",
      isArchived && "pointer-events-none"
    )}>
      <div className="overflow-x-auto custom-scroll pb-1">
        <table className="thought-table mt-1 border-collapse w-full text-[10px] select-none">
          <tbody>
            {visibleRows.map((row, r) => (
              <tr key={r} className={cn(r % 2 === 0 ? "bg-white/[0.01]" : "")}>
                {row.slice(0, maxCols).map((cell, c) => (
                  <td key={c} className="p-2 border-b border-[var(--glass-border)] text-[var(--text-dimmed)] whitespace-nowrap">
                    {cell}
                  </td>
                ))}
                {hasMoreCols && <td className="p-2 border-b border-[var(--glass-border)] text-[8px] opacity-30">...</td>}
              </tr>
            ))}
            {hasMoreRows && (
              <tr>
                <td colSpan={Math.min(maxCols, table[0]?.length || 0) + (hasMoreCols ? 1 : 0)} className="text-center text-[8px] text-[var(--text-muted)] py-1">
                  ... and {table.length - maxRows} more rows
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!isReadOnly && !isArchived && (
        <div className="absolute inset-0 bg-[var(--accent)]/10 opacity-0 group-hover/table:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
          <button
            onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'table'); }}
            className="pointer-events-auto prevent-drag bg-[var(--accent)] text-[var(--accent-contrast)] p-2 rounded-lg shadow-xl transform scale-90 group-hover/table:scale-100 transition-all hover:scale-110 active:scale-95"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
