import React from 'react';
import { LinkIcon, Link2Off } from 'lucide-react';
import { type Thought } from '../../db';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ThoughtFooterProps {
  thought: Thought;
  stack: any;
  isReadOnly: boolean;
  isSpatial: boolean;
  linkingSourceId: number | null;
  handleLinkAction: (e: React.MouseEvent) => void;
}

export const ThoughtFooter: React.FC<ThoughtFooterProps> = ({ 
  thought, 
  stack, 
  isReadOnly, 
  isSpatial,
  linkingSourceId, 
  handleLinkAction 
}) => {
  return (
    <>
      <div className="flex items-center gap-2 mt-1">
        {stack && (
          <div
            className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border border-white/10"
            style={{
              backgroundColor: stack.color ? stack.color.replace('1)', '0.15)') : 'rgba(255,255,255,0.1)',
              color: stack.color || '#fff',
              borderColor: stack.color ? stack.color.replace('1)', '0.3)') : 'rgba(255,255,255,0.2)'
            }}
          >
            {stack.name || "Unnamed Stack"}
          </div>
        )}
      </div>

      {!isReadOnly && isSpatial && (
        <button
          onClick={handleLinkAction}
          className={cn(
            "absolute bottom-2.5 right-2.5 p-1.5 rounded-xl transition-all z-10",
            linkingSourceId === thought.id
              ? "bg-[var(--accent)] text-white shadow-[0_0_20px_var(--accent-glow)]"
              : "bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 border border-white/5",
            thought.stackId && "hover:text-red-400 hover:bg-red-500/10"
          )}
          title={thought.stackId ? "Remove from stack" : "Link to another thought"}
        >
          {thought.stackId ? (
            <Link2Off className="w-4 h-4" />
          ) : (
            <LinkIcon className="w-4 h-4" />
          )}
        </button>
      )}
    </>
  );
};
