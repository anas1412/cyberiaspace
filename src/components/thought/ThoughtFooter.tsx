import React from 'react';
import { Link2, Link2Off } from 'lucide-react';
import { type Thought } from '../../db';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ThoughtFooterProps {
  thought: Thought;
  isReadOnly: boolean;
  isSpatial: boolean;
  isExpanded?: boolean;
  linkingSourceId: string | null;
  handleLinkAction: (e: React.MouseEvent) => void;
}

export const ThoughtFooter: React.FC<ThoughtFooterProps> = ({ 
  thought, 
  isReadOnly, 
  isSpatial,
  isExpanded = true,
  linkingSourceId, 
  handleLinkAction 
}) => {
  if (!isExpanded) return null;

  return (
    <div className="mt-auto">
      {/* The "Label" style line - Always visible for all thought types */}
      <div className="py-1 opacity-20 mt-2 flex justify-center">
      <div className="h-[1px] w-[100%] bg-blue-500/50 rounded-full" />
    </div>
      
      <div className="flex items-center justify-end min-h-[15px] pt-3">
        {!isReadOnly && isSpatial && (
          <button
            onClick={handleLinkAction}
            className={cn(
              "p-1.5 rounded-xl transition-all relative",
              linkingSourceId === thought.id
                ? "bg-[var(--accent)] text-white shadow-[0_0_20px_var(--accent-glow)]"
                : "bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 border border-white/5",
              thought.stackId && !linkingSourceId && "hover:text-red-400 hover:bg-red-500/10"
            )}
            title={
              linkingSourceId === thought.id 
                ? "Cancel Linking" 
                : thought.stackId 
                  ? "Remove from collection" 
                  : "Link to another thought"
            }
          >
            {thought.stackId && linkingSourceId !== thought.id ? (
              <Link2Off className="w-4 h-4" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};
