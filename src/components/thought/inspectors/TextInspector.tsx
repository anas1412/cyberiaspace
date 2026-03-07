import React from 'react';
import { useStore } from '../../../store/useStore';
import { type InspectorPanelProps } from '../registry';
import { Maximize2 } from 'lucide-react';

export const TextInspector: React.FC<InspectorPanelProps> = ({ thought }) => {
  const setActiveFocus = useStore(state => state.setActiveFocus);

  return (
    <button
      onClick={() => setActiveFocus(thought.id, 'text')}
      className="w-full bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-[var(--accent-secondary)] py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex flex-col items-center justify-center gap-3"
    >
      <Maximize2 className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" />
      Open Full-Screen Editor
    </button>
  );
};
