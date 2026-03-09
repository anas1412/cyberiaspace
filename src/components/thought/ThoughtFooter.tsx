import React from 'react';
import { Link2, Link2Off } from 'lucide-react';
import { type Thought } from '../../db';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const toRgba = (color: string, alpha: number) => {
  // Handle hex colors (#6366f1)
  const hexMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (hexMatch) {
    return `rgba(${parseInt(hexMatch[1], 16)}, ${parseInt(hexMatch[2], 16)}, ${parseInt(hexMatch[3], 16)}, ${alpha})`;
  }
  
  // Handle HSLA colors (hsla(262, 70%, 50%, 1))
  const hslaMatch = /^hsla?\((\d+),\s*(\d+)%?,\s*(\d+)%?,\s*([\d.]+)\)$/i.exec(color);
  if (hslaMatch) {
    return `hsla(${hslaMatch[1]}, ${hslaMatch[2]}%, ${hslaMatch[3]}%, ${alpha})`;
  }
  
  // Handle RGBA colors - replace alpha
  if (color.includes('rgba')) {
    return color.replace(/[\d.]+\)$/, `${alpha})`);
  }
  
  // Return original if no match, fallback to white
  return color;
};

interface ThoughtFooterProps {
  thought: Thought;
  stack: any;
  isReadOnly: boolean;
  isSpatial: boolean;
  linkingSourceId: string | null;
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
              backgroundColor: stack.color ? toRgba(stack.color, 0.15) : 'rgba(255,255,255,0.1)',
              color: stack.color || '#fff',
              borderColor: stack.color ? toRgba(stack.color, 0.3) : 'rgba(255,255,255,0.2)'
            }}
          >
            {stack.name || "New Collection"}
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
    </>
  );
};
