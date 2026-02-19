import React from 'react';
import { type Thought } from '../../db';

interface LabelRendererProps {
  thought: Thought;
}

export const LabelRenderer: React.FC<LabelRendererProps> = () => {
  return (
    <div data-trigger="label" className="py-1 opacity-20">
      <div className="h-[1px] w-full bg-indigo-500/50 rounded-full" />
    </div>
  );
};
