import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Table as TableIcon, X, Plus, Trash2, Download } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getTagStyle = (tag: string) => {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = tag.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h * 137.5) % 360;
  return {
    backgroundColor: `hsla(${hue}, 70%, 50%, 0.15)`,
    color: `hsla(${hue}, 90%, 75%, 1)`,
    borderColor: `hsla(${hue}, 70%, 50%, 0.3)`,
  };
};

const TableFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const thoughts = useStore((state) => state.thoughts);
  const updateThought = useStore((state) => state.updateThought);

  const [isEditMode, setIsEditMode] = useState(false);

  const thought = thoughts.find((t) => t.id === activeFocusId);
  const isVisible = focusType === 'table' && !!thought;

  const handleUpdateCell = (r: number, c: number, val: string) => {
    if (!thought) return;
    const newTable = [...thought.table.map(row => [...row])];
    newTable[r][c] = val;
    updateThought(thought.id, { table: newTable });
  };

  const addRow = () => {
    if (!thought) return;
    const colCount = thought.table[0]?.length || 2;
    updateThought(thought.id, { table: [...thought.table, new Array(colCount).fill("")] });
  };

  const addColumn = () => {
    if (!thought) return;
    const newTable = thought.table.map(row => [...row, ""]);
    updateThought(thought.id, { table: newTable });
  };

  const deleteRow = (idx: number) => {
    if (!thought || thought.table.length <= 1) return;
    const newTable = [...thought.table];
    newTable.splice(idx, 1);
    updateThought(thought.id, { table: newTable });
  };

  const deleteColumn = (idx: number) => {
    if (!thought || thought.table[0].length <= 1) return;
    const newTable = thought.table.map(row => {
      const newRow = [...row];
      newRow.splice(idx, 1);
      return newRow;
    });
    updateThought(thought.id, { table: newTable });
  };

  const exportCSV = () => {
    if (!thought) return;
    const csv = thought.table.map(row => row.map(cell => `"${cell.split('"').join('""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${thought.text || 'table'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      {isVisible && thought && (
        <motion.div 
          id="table-focus-overlay" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[10001] bg-[#020408]/70 backdrop-blur-[40px] flex items-center justify-center p-10"
          onClick={() => setActiveFocus(null, null)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="focus-box glass rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl w-full max-w-[1000px] h-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-8 border-b border-white/5 bg-black/20">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400">
                  <TableIcon className="w-6 h-6" />
                </div>
                <input 
                  value={thought.text} 
                  onChange={(e) => updateThought(thought.id, { text: e.target.value })}
                  className="bg-transparent text-2xl font-bold text-white outline-none border-none p-0 w-[400px]"
                  placeholder="Untitled Table"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
                  <button 
                    onClick={() => setIsEditMode(false)}
                    className={cn(
                      "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      !isEditMode ? "bg-slate-700 text-white" : "text-slate-500 hover:text-white"
                    )}
                  >
                    View
                  </button>
                  <button 
                    onClick={() => setIsEditMode(true)}
                    className={cn(
                      "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      isEditMode ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 hover:text-white"
                    )}
                  >
                    Edit
                  </button>
                </div>
                <button 
                  onClick={() => setActiveFocus(null, null)}
                  className="p-4 hover:bg-red-500/10 rounded-2xl text-slate-400 hover:text-red-400 transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto custom-scroll p-12 relative bg-black/10">
              <div className="table-wrapper mx-auto w-max min-w-full shadow-2xl mb-12 border border-white/10 rounded-3xl bg-black/20 overflow-hidden">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            {isEditMode && <th className="p-2 border border-white/5 w-10 bg-black/40"></th>}
                            {thought.table[0].map((cell, i) => (
                                <th key={i} className="p-0 border border-white/5 bg-black/40 min-w-[150px]">
                                    {isEditMode ? (
                                        <div className="flex items-center group/h h-full">
                                            <input
                                                value={cell}
                                                onChange={(e) => handleUpdateCell(0, i, e.target.value)}
                                                className="flex-1 bg-transparent p-4 outline-none text-xs font-black uppercase tracking-widest text-indigo-400 placeholder:text-indigo-400/20"
                                                placeholder={`COL ${i + 1}`}
                                            />
                                            <button onClick={() => deleteColumn(i)} className="p-2 opacity-0 group-hover/h:opacity-100 text-red-400 hover:text-red-300 transition-opacity">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="p-4 text-xs font-black uppercase tracking-widest text-indigo-400">
                                            {cell || `COL ${i + 1}`}
                                        </div>
                                    )}
                                </th>
                            ))}
                            {isEditMode && (
                                <th className="p-2 border border-white/5 w-16 bg-black/40">
                                    <button onClick={addColumn} className="w-full h-full flex items-center justify-center hover:bg-white/5 rounded-lg py-2 transition-colors">
                                        <Plus className="w-5 h-5 text-indigo-400" />
                                    </button>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {thought.table.slice(1).map((row, rIdx) => {
                            const actualRow = rIdx + 1;
                            return (
                                <tr key={actualRow} className="hover:bg-white/[0.02] transition-colors">
                                    {isEditMode && (
                                        <td className="p-2 border border-white/5 bg-black/20 text-[10px] text-slate-500 font-mono text-center relative group w-10">
                                            {actualRow + 1}
                                            <button onClick={() => deleteRow(actualRow)} className="absolute inset-0 flex items-center justify-center bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    )}
                                    {row.map((cell, cIdx) => (
                                        <td key={cIdx} className="border border-white/5 p-0">
                                            {isEditMode ? (
                                                <input
                                                    value={cell}
                                                    onChange={(e) => handleUpdateCell(actualRow, cIdx, e.target.value)}
                                                    className="w-full h-full bg-transparent p-4 outline-none text-sm text-white focus:bg-indigo-500/10 transition-colors"
                                                    placeholder="..."
                                                />
                                            ) : (
                                                <div className="p-4 text-sm text-white/70 min-h-[52px] flex items-center">
                                                    {cell}
                                                </div>
                                            )}
                                        </td>
                                    ))}
                                    {isEditMode && <td className="border border-white/5 bg-black/10"></td>}
                                </tr>
                            );
                        })}
                        {isEditMode && (
                            <tr>
                                <td className="p-2 border border-white/5 text-center bg-black/20">
                                    <button onClick={addRow} className="w-full h-full flex items-center justify-center hover:bg-white/5 rounded-lg py-2 transition-colors">
                                        <Plus className="w-5 h-5 text-indigo-400" />
                                    </button>
                                </td>
                                <td colSpan={thought.table[0].length + (isEditMode ? 1 : 0)} className="border border-white/5 bg-black/10"></td>
                            </tr>
                        )}
                    </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 bg-black/40 border-t border-white/5 flex justify-between items-center">
              <div className="flex gap-2">
                {thought.tags.map((tag, i) => (
                  <span key={i} className="tag-pill text-[9px] font-700 px-2.5 py-1 rounded-lg border border-white/10" style={getTagStyle(tag)}>
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-6">
                <p className="text-[10px] uppercase font-black tracking-widest text-slate-600">Tip: Headers are in the first row</p>
                <button onClick={exportCSV} className="text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-white transition-colors flex items-center gap-2">
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TableFocusEditor;
