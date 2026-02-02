import React from 'react';
import { useStore } from '../store/useStore';
import { Table as TableIcon, X, Plus, Trash2, Download } from 'lucide-react';

const TableFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const thoughts = useStore((state) => state.thoughts);
  const updateThought = useStore((state) => state.updateThought);

  const thought = thoughts.find((t) => t.id === activeFocusId);

  if (focusType !== 'table' || !thought) return null;

  const handleUpdateCell = (r: number, c: number, val: string) => {
    const newTable = [...thought.table.map(row => [...row])];
    newTable[r][c] = val;
    updateThought(thought.id, { table: newTable });
  };

  const addRow = () => {
    const colCount = thought.table[0]?.length || 2;
    updateThought(thought.id, { table: [...thought.table, new Array(colCount).fill("")] });
  };

  const addColumn = () => {
    const newTable = thought.table.map(row => [...row, ""]);
    updateThought(thought.id, { table: newTable });
  };

  const deleteRow = (idx: number) => {
    if (thought.table.length <= 1) return;
    const newTable = [...thought.table];
    newTable.splice(idx, 1);
    updateThought(thought.id, { table: newTable });
  };

  const deleteColumn = (idx: number) => {
    if (thought.table[0].length <= 1) return;
    const newTable = thought.table.map(row => {
      const newRow = [...row];
      newRow.splice(idx, 1);
      return newRow;
    });
    updateThought(thought.id, { table: newTable });
  };

  const exportCSV = () => {
    const csv = thought.table.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${thought.text || 'table'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="table-focus-overlay" className="fixed inset-0 z-[10001] bg-[#020408]/90 backdrop-blur-[40px] flex flex-col p-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl">
            <TableIcon className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <input 
              value={thought.text} 
              onChange={(e) => updateThought(thought.id, { text: e.target.value })}
              className="bg-transparent text-2xl font-bold text-white outline-none placeholder:text-white/20"
              placeholder="Table Title"
            />
            <p className="text-sm text-slate-500 font-mono">CSV EDITOR</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors">
            <Download className="w-5 h-5" />
          </button>
          <button onClick={() => setActiveFocus(null, null)} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scroll border border-white/10 rounded-3xl bg-black/20 p-1 relative">
        <table className="w-full border-collapse">
            <thead>
                <tr>
                    <th className="p-2 border border-white/5 w-10"></th>
                    {thought.table[0].map((_, i) => (
                        <th key={i} className="p-2 border border-white/5 bg-white/5 text-xs text-slate-500 font-mono relative group">
                            Col {i + 1}
                            <button onClick={() => deleteColumn(i)} className="absolute right-1 top-1.5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </th>
                    ))}
                    <th className="p-2 border border-white/5 w-10">
                        <button onClick={addColumn} className="w-full h-full flex items-center justify-center hover:bg-white/5 rounded">
                            <Plus className="w-4 h-4 text-indigo-400" />
                        </button>
                    </th>
                </tr>
            </thead>
            <tbody>
                {thought.table.map((row, r) => (
                    <tr key={r}>
                        <td className="p-2 border border-white/5 bg-white/5 text-xs text-slate-500 font-mono text-center relative group w-10">
                            {r + 1}
                            <button onClick={() => deleteRow(r)} className="absolute left-1 top-2.5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </td>
                        {row.map((cell, c) => (
                            <td key={c} className="border border-white/5 p-0 min-w-[120px]">
                                <input
                                    value={cell}
                                    onChange={(e) => handleUpdateCell(r, c, e.target.value)}
                                    className="w-full h-full bg-transparent p-3 outline-none text-sm text-white focus:bg-indigo-500/10 transition-colors"
                                />
                            </td>
                        ))}
                        <td className="border border-white/5 bg-white/[0.02]"></td>
                    </tr>
                ))}
                <tr>
                    <td className="p-2 border border-white/5 text-center">
                        <button onClick={addRow} className="w-full h-full flex items-center justify-center hover:bg-white/5 rounded p-1">
                            <Plus className="w-4 h-4 text-indigo-400" />
                        </button>
                    </td>
                    <td colSpan={thought.table[0].length + 1} className="border border-white/5 bg-white/[0.02]"></td>
                </tr>
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default TableFocusEditor;
