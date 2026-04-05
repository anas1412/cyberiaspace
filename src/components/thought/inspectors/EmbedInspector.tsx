import React from 'react';
import { useThoughtPayload } from '../hooks/useThoughtPayload';
import { type InspectorPanelProps } from '../registry';
import { fetchEmbedMeta } from '../../../utils/embeds';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useStore } from '../../../store/useStore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const EmbedInspector: React.FC<InspectorPanelProps> = ({ thought, isReadOnly }) => {
  const updateThought = useStore(state => state.updateThought);
  const { content } = useThoughtPayload(thought);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-[9px] uppercase font-bold tracking-widest text-[var(--text-muted)] ml-1">URL</label>
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
                      description: metadata.description || "",
                      image: metadata.thumbnail_url || null
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
            "w-full bg-[var(--bg-page)]/40 border border-[var(--glass-border)] rounded-xl p-3 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)]",
            isReadOnly && "opacity-50 pointer-events-none"
          )}
        />
      </div>
    </div>
  );
};
