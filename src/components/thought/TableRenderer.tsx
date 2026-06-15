import React from 'react';
import { Table } from 'lucide-react';
import { type Thought } from '../../db';
import { useThoughtPayload } from './hooks/useThoughtPayload';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TableRendererProps {
  thought: Thought;
  isArchived?: boolean;
  setActiveFocus: (id: string, type: 'text' | 'tasks' | 'paint' | 'table' | 'embed' | 'file' | 'image') => void;
}

export const TableRenderer: React.FC<TableRendererProps> = ({ 
  thought, 
  isArchived = false,
  setActiveFocus 
}) => {
  const { table } = useThoughtPayload(thought);
  
  const isTableEmpty = !table || table.every(row => row.every(cell => !cell || !cell.trim()));

  if (isTableEmpty) {
    return (
      <div data-trigger="table" className={cn(
        "flex flex-col items-center justify-center py-5 gap-1.5 group/table relative cursor-pointer",
        isArchived && "pointer-events-none"
      )}
        onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'table'); }}
      >
        <Table className="w-5 h-5 text-[var(--text-muted)]/30" />
        <span className="text-[9px] text-[var(--text-muted)]/40 font-medium tracking-widest">
          Build Table
        </span>
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
      "relative group/table overflow-hidden cursor-pointer min-h-[60px] flex flex-col justify-center",
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
    </div>
  );
};
