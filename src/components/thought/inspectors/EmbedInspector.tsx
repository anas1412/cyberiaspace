import React from 'react';
import { Share2 } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { useThoughtPayload } from '../hooks/useThoughtPayload';
import { type InspectorPanelProps } from '../registry';
import { fetchEmbedMeta } from '../../../utils/embeds';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const EmbedInspector: React.FC<InspectorPanelProps> = ({ thought, isReadOnly }) => {
  const setActiveFocus = useStore(state => state.setActiveFocus);
  const updateThought = useStore(state => state.updateThought);
  const { content } = useThoughtPayload(thought);

  return (
    <div className="space-y-4">
      <button
        onClick={() => setActiveFocus(thought.id, 'embed')}
        className="w-full bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-[var(--accent-secondary)] py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex flex-col items-center gap-3"
      >
        <Share2 className="w-5 h-5" />
        Open Interaction Layer
      </button>

      <div className="space-y-2">
        <label className="text-[9px] uppercase font-bold tracking-widest text-slate-500 ml-1">Universal URL</label>
        <input
          type="text"
          readOnly={isReadOnly}
          value={content}
          onChange={(e) => {
            const newUrl = e.target.value;
            updateThought(thought.id, { 
              data: { type: 'embed', url: newUrl } 
            });

            if (newUrl.startsWith('http')) {
              fetchEmbedMeta(newUrl)
                .then(metadata => {
                  if (metadata && metadata.title) {
                    updateThought(thought.id, {
                      text: metadata.title,
                      author: metadata.author_name || "",
                      description: metadata.description || ""
                    });
                  }
                })
                .catch(err => {
                  console.warn("Embed metadata fetch failed:", err);
                });
            }
          }}
          placeholder="Paste Spotify, YouTube, X, or Reddit link..."
          className={cn(
            "w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-[var(--accent)] text-white",
            isReadOnly && "opacity-50 pointer-events-none"
          )}
        />
      </div>
    </div>
  );
};
