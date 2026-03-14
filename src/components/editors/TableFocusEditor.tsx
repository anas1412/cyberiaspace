import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useThoughtPayload } from '../thought/hooks/useThoughtPayload';
import { Plus, Trash2, Download } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';
import { FocusEditorShell } from './FocusEditorShell';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const EditorContent: React.FC<{
  isEditMode: boolean;
  table: string[][];
  onUpdateCell: (r: number, c: number, val: string) => void;
  onAddRow: () => void;
  onAddColumn: () => void;
  onDeleteRow: (idx: number) => void;
  onDeleteColumn: (idx: number) => void;
}> = ({ isEditMode, table, onUpdateCell, onAddRow, onAddColumn, onDeleteRow, onDeleteColumn }) => (
  <div className="flex-1 overflow-auto custom-scroll p-3 md:p-12 relative bg-[var(--bg-main)]/10">
    <div className="table-wrapper mx-auto w-max min-w-full shadow-2xl mb-12 border border-[var(--glass-border)] rounded-xl md:rounded-3xl bg-[var(--bg-main)]/20 overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {isEditMode && <th className="p-1 md:p-2 border border-[var(--glass-border)] w-8 md:w-10 bg-black/40"></th>}
            {table[0]?.map((cell: string, i: number) => (
              <th key={i} className="p-0 border border-[var(--glass-border)] bg-black/40 min-w-[100px] md:min-w-[150px]">
                {isEditMode ? (
                  <div className="flex items-center group/h h-full">
                    <input
                      value={cell}
                      onChange={(e) => onUpdateCell(0, i, e.target.value)}
                      className="flex-1 bg-transparent p-2 md:p-4 outline-none text-[9px] md:text-xs font-black uppercase tracking-widest text-[var(--accent-secondary)] placeholder:text-[var(--accent-secondary)]/20"
                      placeholder={`COL ${i + 1}`}
                    />
                    <button onClick={() => onDeleteColumn(i)} className="p-1 md:p-2 opacity-0 group-hover/h:opacity-100 text-red-400 hover:text-red-300 transition-opacity">
                      <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="p-2 md:p-4 text-[9px] md:text-xs font-black uppercase tracking-widest text-[var(--accent-secondary)]">
                    {cell || `COL ${i + 1}`}
                  </div>
                )}
              </th>
            ))}
            {isEditMode && (
              <th className="p-1 md:p-2 border border-[var(--glass-border)] w-10 md:w-16 bg-black/40">
                <button onClick={onAddColumn} className="w-full h-full flex items-center justify-center hover:bg-white/5 rounded-md md:rounded-lg py-1 md:py-2 transition-colors">
                  <Plus className="w-4 h-4 md:w-5 md:h-5 text-[var(--accent-secondary)]" />
                </button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {table.slice(1).map((row: string[], rIdx: number) => {
            const actualRow = rIdx + 1;
            return (
              <tr key={actualRow} className="hover:bg-white/[0.02] transition-colors">
                {isEditMode && (
                  <td className="p-1 md:p-2 border border-[var(--glass-border)] bg-black/20 text-[8px] md:text-[10px] text-[var(--text-muted)] font-mono text-center relative group w-8 md:w-10">
                    {actualRow + 1}
                    <button onClick={() => onDeleteRow(actualRow)} className="absolute inset-0 flex items-center justify-center bg-red-500 text-[var(--accent-contrast)] opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3.5 h-3.5 md:w-4 h-4" />
                    </button>
                  </td>
                )}
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="border border-[var(--glass-border)] p-0">
                    {isEditMode ? (
                      <input
                        value={cell}
                        onChange={(e) => onUpdateCell(actualRow, cIdx, e.target.value)}
                        className="w-full h-full bg-transparent p-2 md:p-4 outline-none text-[11px] md:text-sm text-[var(--text-primary)] focus:bg-[var(--accent)]/10 transition-colors"
                        placeholder="..."
                      />
                    ) : (
                      <div className="p-2 md:p-4 text-[11px] md:text-sm text-[var(--text-dimmed)] min-h-[36px] md:min-h-[52px] flex items-center">
                        {cell}
                      </div>
                    )}
                  </td>
                ))}
                {isEditMode && <td className="border border-[var(--glass-border)] bg-black/10"></td>}
              </tr>
            );
          })}
          {isEditMode && (
            <tr>
              <td className="p-1 md:p-2 border border-[var(--glass-border)] text-center bg-black/20">
                <button onClick={onAddRow} className="w-full h-full flex items-center justify-center hover:bg-white/5 rounded-md md:rounded-lg py-1 md:py-2 transition-colors">
                  <Plus className="w-4 h-4 md:w-5 md:h-5 text-[var(--accent-secondary)]" />
                </button>
              </td>
              <td colSpan={(table[0]?.length || 0) + (isEditMode ? 1 : 0)} className="border border-[var(--glass-border)] bg-black/10"></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const TableFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const updateThought = useStore((state) => state.updateThought);
  const isReadOnly = useStore((state) => state.isReadOnly);

  const [isEditMode, setIsEditMode] = useState(false);
  const thought = thoughts.find((t) => t.id === activeFocusId);
  const { table } = useThoughtPayload(thought as any);
  const stack = stacks.find((s) => s.id === thought?.stackId);
  const isVisible = focusType === 'table' && !!thought;

  const saveTable = (newTable: string[][]) => {
    if (!thought) return;
    updateThought(thought.id, { 
      data: { type: 'table', rows: newTable } 
    });
  };

  const handleUpdateCell = (r: number, c: number, val: string) => {
    if (!thought || isReadOnly) return;
    const newTable = [...table.map(row => [...row])];
    newTable[r][c] = val;
    saveTable(newTable);
  };

  const addRow = () => {
    if (!thought || isReadOnly) return;
    const colCount = table[0]?.length || 2;
    saveTable([...table, new Array(colCount).fill("")]);
  };

  const addColumn = () => {
    if (!thought || isReadOnly) return;
    const newTable = table.map(row => [...row, ""]);
    saveTable(newTable);
  };

  const deleteRow = (idx: number) => {
    if (!thought || table.length <= 1 || isReadOnly) return;
    const newTable = [...table];
    newTable.splice(idx, 1);
    saveTable(newTable);
  };

  const deleteColumn = (idx: number) => {
    if (!thought || table[0].length <= 1 || isReadOnly) return;
    const newTable = table.map(row => {
      const newRow = [...row];
      newRow.splice(idx, 1);
      return newRow;
    });
    saveTable(newTable);
  };

  const exportCSV = () => {
    if (!thought) return;
    const csv = table.map(row => row.map(cell => `"${cell.split('"').join('""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${thought.text || 'table'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!thought) return null;

  return (
    <FocusEditorShell
      isVisible={isVisible}
      onClose={() => setActiveFocus(null, null)}
      title={thought.text}
      onTitleChange={(val) => { if (!isReadOnly) updateThought(thought.id, { text: val }); }}
      description={thought.description}
      isReadOnly={isReadOnly}
      stack={stack}
      headerActions={
        <div className="flex bg-[var(--bg-main)]/40 p-1 rounded-xl md:rounded-2xl border border-[var(--glass-border)] relative">
          {[
            { id: false, label: 'View' },
            { id: true, label: 'Edit' }
          ].map((mode) => (
            <button
              key={mode.label}
              onClick={() => setIsEditMode(mode.id)}
              disabled={mode.id === true && isReadOnly}
                className={cn(
                  "relative px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all duration-300 z-10",
                  isEditMode === mode.id 
                    ? (mode.id === true ? "text-[var(--accent-contrast)]" : "text-[var(--text-primary)]")
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                  mode.id === true && isReadOnly && "opacity-30 cursor-not-allowed"
                )}
            >
              {isEditMode === mode.id && (
                <motion.div
                  layoutId="activeTab"
                  className={cn(
                    "absolute inset-0 rounded-lg md:rounded-xl shadow-lg z-[-1]",
                    mode.id === true 
                      ? "bg-[var(--accent)] shadow-[var(--accent-glow)]" 
                      : "bg-white/10 border border-white/10"
                  )}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              {mode.label}
            </button>
          ))}
        </div>
      }
      footerActions={
        <button onClick={exportCSV} className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-[var(--text-dimmed)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-2">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      }
    >
      <EditorContent 
        isEditMode={isEditMode}
        table={table}
        onUpdateCell={handleUpdateCell}
        onAddRow={addRow}
        onAddColumn={addColumn}
        onDeleteRow={deleteRow}
        onDeleteColumn={deleteColumn}
      />
    </FocusEditorShell>
  );
};

export default TableFocusEditor;
