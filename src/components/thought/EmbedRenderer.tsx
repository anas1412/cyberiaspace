import React, { useEffect, useState } from 'react';
import { Music, Loader2, ExternalLink, Play, Link2 } from 'lucide-react';
import { type Thought } from '../../db';
import { useThoughtPayload } from './hooks/useThoughtPayload';
import { getEmbedInfo, fetchEmbedMeta } from '../../utils/embeds';
import { PROVIDER_CONFIG } from './constants';
import { useStore } from '../../store/useStore';

interface EmbedRendererProps {
  thought: Thought;
}

export const EmbedRenderer: React.FC<EmbedRendererProps> = ({ thought }) => {
  // Use the dual-read hook for backward compatibility
  const { content } = useThoughtPayload(thought);
  
  const { provider, id } = getEmbedInfo(content);
  const config = PROVIDER_CONFIG[provider as string] || PROVIDER_CONFIG.unknown;
  const Icon = config.icon;
  const updateThought = useStore(state => state.updateThought);
  const [isLoading, setIsLoading] = useState(false);

  // Automatic Metadata Sync
  useEffect(() => {
    // Trigger if we are missing key pieces of metadata but have content
    const isMissingMetadata = !thought.meta?.thumbnail_url || !thought.author || !thought.description;
    const shouldFetch = isMissingMetadata && content && !content.includes('localhost') && content.startsWith('http');
    
    if (shouldFetch) {
      const syncMetadata = async () => {
        setIsLoading(true);
        try {
          const meta = await fetchEmbedMeta(content);
          if (meta) {
            const updates: any = {};
            if (meta.author_name) updates.author = meta.author_name;
            if (meta.title && meta.title !== content) updates.text = meta.title;
            if (meta.description) updates.description = meta.description;
            if (meta.thumbnail_url) {
              updates.meta = { ...(thought.meta || {}), thumbnail_url: meta.thumbnail_url };
            }
            
            if (Object.keys(updates).length > 0) {
              await updateThought(thought.id, updates);
            }
          }
        } catch (err) {
          console.warn('[EmbedRenderer] Auto-sync failed:', err);
        } finally {
          setIsLoading(false);
        }
      };
      syncMetadata();
    }
  }, [thought.id, content, thought.meta?.thumbnail_url, thought.author, updateThought, thought.text]);

  const previewImage = thought.meta?.thumbnail_url || (provider === 'youtube' && id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null);

  // Empty state — no URL/content
  if (!content) {
    return (
      <div data-trigger="embed" className="flex flex-col items-center justify-center py-5 gap-1.5 cursor-pointer">
        <Link2 className="w-5 h-5 text-[var(--text-muted)]/30" />
        <span className="text-[9px] text-[var(--text-muted)]/40 font-medium tracking-widest">Paste URL</span>
      </div>
    );
  }

  return (
    <div data-trigger="embed" className="mt-2 relative group cursor-pointer overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--node-bg)]/40 aspect-video flex items-center justify-center">
      {previewImage ? (
        <div className="relative w-full h-full">
          <img
            src={previewImage}
            draggable="false"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
            alt="Preview"
          />
          {provider === 'youtube' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-11 bg-red-600 rounded-xl flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 fill-current" />
              </div>
            </div>
          )}
        </div>
      ) : provider === 'spotify' ? (
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1db954]/20 flex items-center justify-center border border-[#1db954]/40 shadow-[0_0_30px_rgba(29,185,84,0.2)] animate-pulse">
            <Music className="w-8 h-8 text-[#1db954]" />
          </div>
          <span className="text-[10px] text-[#1db954] font-semibold tracking-widest">{thought.text || 'Spotify Track'}</span>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center gap-2 p-6 text-center">
          <Loader2 className="w-8 h-8 text-[var(--text-muted)] animate-spin" />
          <span className="text-[10px] text-[var(--text-muted)] font-semibold tracking-widest">Loading preview...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 p-6 text-center">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center border"
            style={{ backgroundColor: `${config.color}15`, borderColor: `${config.color}30` }}
          >
            <Icon className="w-6 h-6" style={{ color: config.color }} />
          </div>
          <span className="text-[10px] font-semibold tracking-widest leading-tight" style={{ color: config.color }}>
            {thought.author || thought.text || `View on ${config.label}`}
          </span>
        </div>
      )}

      {(thought.author || isLoading) && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-10 pointer-events-none transition-opacity group-hover:opacity-100 opacity-80">
          <p className="text-[10px] text-[var(--text-primary)] font-semibold tracking-widest truncate">
            {isLoading ? 'Fetching metadata...' : thought.author}
          </p>
          {thought.text && thought.text.includes(' by ') && (
            <p className="text-[8px] text-[var(--text-dimmed)] font-medium italic mt-0.5 truncate">
              {thought.text}
            </p>
          )}
        </div>
      )}
      
      {!previewImage && !isLoading && (
        <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-[var(--node-bg)]/20 border border-[var(--glass-border)] opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
        </div>
      )}
    </div>
  );
};
