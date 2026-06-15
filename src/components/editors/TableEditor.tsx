import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useThoughtPayload } from '../thought/hooks/useThoughtPayload';
import { Plus, Trash2, Download, Edit3, Eye, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { type Thought } from '../../db';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TableEditorProps {
  thought: Thought;
  onClose: () => void;
}

const TableEditor: React.FC<TableEditorProps> = ({ thought, onClose }) => {
  const updateThought = useStore((state) => state.updateThought);
  const [isEditMode, setIsEditMode] = useState(false);

  const { table } = useThoughtPayload(thought);

  const saveTable = (newTable: string[][]) => {
    updateThought(thought.id, {
      data: { type: 'table', rows: newTable }
    });
  };

  const handleUpdateCell = (r: number, c: number, val: string) => {
    const newTable = [...table.map(row => [...row])];
    newTable[r][c] = val;
    saveTable(newTable);
  };

  const addRow = () => {
    const colCount = table[0]?.length || 2;
    saveTable([...table, new Array(colCount).fill("")]);
  };

  const addColumn = () => {
    const newTable = table.map(row => [...row, ""]);
    saveTable(newTable);
  };

  const deleteRow = (idx: number) => {
    if (table.length <= 1) return;
    const newTable = [...table];
    newTable.splice(idx, 1);
    saveTable(newTable);
  };

  const deleteColumn = (idx: number) => {
    if (table[0].length <= 1) return;
    const newTable = table.map(row => {
      const newRow = [...row];
      newRow.splice(idx, 1);
      return newRow;
    });
    saveTable(newTable);
  };

  const exportCSV = () => {
    const csv = table.map(row => row.map(cell => `"${cell.split('"').join('""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${thought.text || 'table'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Title strip */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--glass-border)] shrink-0">
        <input
          value={thought.text}
          onChange={(e) => updateThought(thought.id, { text: e.target.value })}
          className="flex-1 bg-transparent text-[11px] text-[var(--text-primary)] font-medium outline-none placeholder:text-[var(--text-muted)]/30"
          placeholder="Table title..."
        />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-semibold tracking-widest transition-all shrink-0",
              isEditMode
                ? "bg-[var(--accent)] text-[var(--bg-page)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
            )}
          >
            {isEditMode ? (
              <><Eye className="w-3 h-3" /> View</>
            ) : (
              <><Edit3 className="w-3 h-3" /> Edit</>
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-all"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Table area */}
      <div className="flex-1 overflow-auto custom-scroll min-h-0">
        <div className="inline-block min-w-full p-3">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {isEditMode && (
                  <th className="p-1 border border-[var(--glass-border)] w-8 bg-[var(--glass-bg)]"></th>
                )}
                {(table[0] ?? []).map((cell: string, i: number) => (
                  <th key={i} className="p-0 border border-[var(--glass-border)] bg-[var(--glass-bg)] min-w-[100px]">
                    {isEditMode ? (
                      <div className="flex items-center group/h h-full">
                        <input
                          value={cell}
                          onChange={(e) => handleUpdateCell(0, i, e.target.value)}
                          className="flex-1 bg-transparent px-2 py-1.5 outline-none text-[9px] font-semibold tracking-widest text-[var(--accent-secondary)] placeholder:text-[var(--accent-secondary)]/20"
                          placeholder={`COL ${i + 1}`}
                        />
                        <button
                          onClick={() => deleteColumn(i)}
                          className="px-1 py-1 opacity-0 group-hover/h:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="px-2 py-1.5 text-[9px] font-semibold tracking-widest text-[var(--accent-secondary)]">
                        {cell || `COL ${i + 1}`}
                      </div>
                    )}
                  </th>
                ))}
                {isEditMode && (
                  <th className="p-1 border border-[var(--glass-border)] w-10 bg-[var(--glass-bg)]">
                    <button
                      onClick={addColumn}
                      className="w-full h-full flex items-center justify-center hover:bg-[var(--glass-bg)] rounded py-1 transition-colors"
                    >
                      <Plus className="w-4 h-4 text-[var(--accent-secondary)]" />
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {table.slice(1).map((row: string[], rIdx: number) => {
                const actualRow = rIdx + 1;
                return (
                  <tr key={actualRow} className={cn(rIdx % 2 === 1 && "bg-[var(--bg-main)]/20")}>
                    {isEditMode && (
                      <td className="p-1 border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[8px] text-[var(--text-muted)] font-mono text-center relative group w-8">
                        {actualRow + 1}
                        <button
                          onClick={() => deleteRow(actualRow)}
                          className="absolute inset-0 flex items-center justify-center bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    )}
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="border border-[var(--glass-border)] p-0">
                        {isEditMode ? (
                          <input
                            value={cell}
                            onChange={(e) => handleUpdateCell(actualRow, cIdx, e.target.value)}
                            className="w-full h-full bg-transparent px-2 py-1.5 outline-none text-[11px] text-[var(--text-primary)] focus:bg-[var(--accent)]/10 transition-colors"
                            placeholder="..."
                          />
                        ) : (
                          <div className="px-2 py-1.5 text-[11px] text-[var(--text-primary)] min-h-[28px] flex items-center">
                            {cell}
                          </div>
                        )}
                      </td>
                    ))}
                    {isEditMode && (
                      <td className="border border-[var(--glass-border)] bg-[var(--glass-bg)]"></td>
                    )}
                  </tr>
                );
              })}
              {isEditMode && (
                <tr>
                  <td className="p-1 border border-[var(--glass-border)] text-center bg-[var(--glass-bg)]">
                    <button
                      onClick={addRow}
                      className="w-full h-full flex items-center justify-center hover:bg-[var(--glass-bg)] rounded py-1 transition-colors"
                    >
                      <Plus className="w-4 h-4 text-[var(--accent-secondary)]" />
                    </button>
                  </td>
                  <td colSpan={(table[0]?.length || 0) + 1} className="border border-[var(--glass-border)] bg-[var(--glass-bg)]"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV export */}
      <div className="shrink-0 px-3 py-1.5 border-t border-[var(--glass-border)]">
        <button
          onClick={exportCSV}
          className="text-[9px] uppercase font-semibold tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5"
        >
          <Download className="w-3 h-3" /> Export CSV
        </button>
      </div>
    </div>
  );
};

export default TableEditor;
