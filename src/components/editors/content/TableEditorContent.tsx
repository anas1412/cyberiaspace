import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface TableEditorContentProps {
  isEditMode: boolean;
  table: string[][];
  onUpdateCell: (r: number, c: number, val: string) => void;
  onAddRow: () => void;
  onAddColumn: () => void;
  onDeleteRow: (idx: number) => void;
  onDeleteColumn: (idx: number) => void;
  isReadOnly?: boolean;
}

export const TableEditorContent: React.FC<TableEditorContentProps> = ({
  isEditMode,
  table,
  onUpdateCell,
  onAddRow,
  onAddColumn,
  onDeleteRow,
  onDeleteColumn
}) => {
  return (
    <div className="flex-1 overflow-auto custom-scroll p-3 relative bg-[var(--bg-main)]/10">
      <div className="table-wrapper mx-auto w-max min-w-full shadow-xl mb-8 border border-[var(--glass-border)] rounded-xl bg-[var(--bg-main)]/20 overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {isEditMode && <th className="p-1 border border-[var(--glass-border)] w-8 bg-[var(--glass-bg)]"></th>}
              {table[0]?.map((cell: string, i: number) => (
                <th key={i} className="p-0 border border-[var(--glass-border)] bg-[var(--glass-bg)] min-w-[80px]">
                  {isEditMode ? (
                    <div className="flex items-center group/h h-full">
                      <input
                        value={cell}
                        onChange={(e) => onUpdateCell(0, i, e.target.value)}
                        className="flex-1 bg-transparent p-2 outline-none text-[9px] font-semibold tracking-widest text-[var(--accent-secondary)]"
                        placeholder={`COL ${i + 1}`}
                      />
                      <button 
                        onClick={() => onDeleteColumn(i)} 
                        className="p-1 opacity-0 group-hover/h:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="p-2 text-[9px] font-semibold tracking-widest text-[var(--accent-secondary)]">
                      {cell || `COL ${i + 1}`}
                    </div>
                  )}
                </th>
              ))}
              {isEditMode && (
                <th className="p-1 border border-[var(--glass-border)] w-10 bg-[var(--glass-bg)]">
                  <button onClick={onAddColumn} className="w-full h-full flex items-center justify-center hover:bg-[var(--glass-bg)] rounded-md py-1 transition-colors">
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
                <tr key={actualRow} className="hover:bg-white/[0.02] transition-colors">
                  {isEditMode && (
                    <td className="p-1 border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[8px] text-[var(--text-muted)] font-mono text-center relative group w-8">
                      {actualRow + 1}
                      <button 
                        onClick={() => onDeleteRow(actualRow)} 
                        className="absolute inset-0 flex items-center justify-center bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="border border-[var(--glass-border)] p-0">
                      {isEditMode ? (
                        <input
                          value={cell}
                          onChange={(e) => onUpdateCell(actualRow, cIdx, e.target.value)}
                          className="w-full h-full bg-transparent p-2 outline-none text-[11px] text-[var(--text-primary)] focus:bg-[var(--accent)]/10 transition-colors"
                          placeholder="..."
                        />
                      ) : (
                        <div className="p-2 text-[11px] text-[var(--text-dimmed)] min-h-[36px] flex items-center">
                          {cell}
                        </div>
                      )}
                    </td>
                  ))}
                  {isEditMode && <td className="border border-[var(--glass-border)] bg-[var(--glass-bg)]"></td>}
                </tr>
              );
            })}
            {isEditMode && (
              <tr>
                <td className="p-1 border border-[var(--glass-border)] text-center bg-[var(--glass-bg)]">
                  <button onClick={onAddRow} className="w-full h-full flex items-center justify-center hover:bg-[var(--glass-bg)] rounded-md py-1 transition-colors">
                    <Plus className="w-4 h-4 text-[var(--accent-secondary)]" />
                  </button>
                </td>
                <td colSpan={(table[0]?.length || 0) + (isEditMode ? 1 : 0)} className="border border-[var(--glass-border)] bg-[var(--glass-bg)]"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};