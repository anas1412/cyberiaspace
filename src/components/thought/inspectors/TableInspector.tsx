import React from 'react';
import { useStore } from '../../../store/useStore';
import { useThoughtPayload } from '../hooks/useThoughtPayload';
import { type InspectorPanelProps } from '../registry';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Download, RotateCcw, Plus } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TableInspector: React.FC<InspectorPanelProps> = ({ thought, isReadOnly }) => {
  const updateThought = useStore(state => state.updateThought);
  const { table } = useThoughtPayload(thought);

  const numRows = table.length;
  const numCols = numRows > 0 ? table[0].length : 0;

  const handleUpdateTable = (newTable: string[][]) => {
    updateThought(thought.id, {
      data: { type: 'table', rows: newTable }
    });
  };

  const addRow = () => {
    const emptyRow = Array(numCols).fill('');
    handleUpdateTable([...table, emptyRow]);
  };

  const addCol = () => {
    const newTable = table.map(row => [...row, '']);
    handleUpdateTable(newTable);
  };

  const resetTable = () => {
    handleUpdateTable([['', ''], ['', '']]);
  };

  const exportCSV = () => {
    const csv = table.map(row =>
      row.map(cell => `"${(cell || '').split('"').join('""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${thought.text || 'table'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-[var(--text-muted)]">
        {numRows} Row{numRows !== 1 ? 's' : ''} × {numCols} Column{numCols !== 1 ? 's' : ''}
      </div>

      <div className="pt-6 border-t border-[var(--glass-border)] space-y-2">
        <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-2">Actions</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={addRow}
            disabled={isReadOnly}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[10px] uppercase font-bold border border-white/10 transition-colors",
              isReadOnly
                ? "text-[var(--text-muted)] cursor-not-allowed"
                : "text-[var(--text-muted)] hover:text-white hover:border-white/20"
            )}
          >
            <Plus className="w-3 h-3" />
            Row
          </button>
          <button
            onClick={addCol}
            disabled={isReadOnly}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[10px] uppercase font-bold border border-white/10 transition-colors",
              isReadOnly
                ? "text-[var(--text-muted)] cursor-not-allowed"
                : "text-[var(--text-muted)] hover:text-white hover:border-white/20"
            )}
          >
            <Plus className="w-3 h-3" />
            Column
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={exportCSV}
            disabled={numRows === 0}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[10px] uppercase font-bold border border-white/10 transition-colors",
              numRows === 0
                ? "text-[var(--text-muted)] cursor-not-allowed"
                : "text-[var(--text-muted)] hover:text-white hover:border-white/20"
            )}
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
          <button
            onClick={resetTable}
            disabled={isReadOnly}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[10px] uppercase font-bold border border-white/10 transition-colors",
              isReadOnly
                ? "text-[var(--text-muted)] cursor-not-allowed"
                : "text-[var(--text-muted)] hover:text-white hover:border-white/20"
            )}
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};
