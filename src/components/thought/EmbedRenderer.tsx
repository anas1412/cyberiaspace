import React, { useEffect, useState } from 'react';
import { Music, Play, Loader2, ExternalLink } from 'lucide-react';
import { type Thought } from '../../db';
import { getEmbedInfo, fetchEmbedMeta } from '../../utils/embeds';
import { PROVIDER_CONFIG } from './constants';
import { useStore } from '../../store/useStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface EmbedRendererProps {
  thought: Thought;
}

export const EmbedRenderer: React.FC<EmbedRendererProps> = ({ thought }) => {
  const { provider, id } = getEmbedInfo(thought.content);
  const config = PROVIDER_CONFIG[provider as string] || PROVIDER_CONFIG.unknown;
  const Icon = config.icon;
  const updateThought = useStore(state => state.updateThought);
  const [isLoading, setIsLoading] = useState(false);

  // Automatic Metadata Sync
  useEffect(() => {
    const shouldFetch = !thought.image && !thought.author && thought.content && !thought.content.includes('localhost');
    
    if (shouldFetch) {
      const syncMetadata = async () => {
        setIsLoading(true);
        try {
          const meta = await fetchEmbedMeta(thought.content);
          if (meta) {
            const updates: any = {};
            if (meta.thumbnail_url) updates.image = meta.thumbnail_url;
            if (meta.author_name) updates.author = meta.author_name;
            if (meta.title && meta.title !== thought.content) updates.text = meta.title;
            if (meta.description) updates.description = meta.description;
            
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
  }, [thought.id, thought.content, thought.image, thought.author, updateThought, thought.text]);

  const previewImage = thought.image || (provider === 'youtube' && id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null);

  return (
    <div data-trigger="embed" className="mt-2 relative group prevent-drag cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black/50 aspect-video flex items-center justify-center">
      {previewImage ? (
        <>
          <img
            src={previewImage}
            draggable="false"
            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
            alt="Preview"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform text-white", 
              provider === 'youtube' ? "bg-red-600" : "bg-black/60 backdrop-blur-md"
            )}>
              {provider === 'youtube' ? <Play className="w-6 h-6 fill-white ml-1" /> : <Icon className="w-6 h-6" style={{ color: config.color }} />}
            </div>
          </div>
        </>
      ) : provider === 'spotify' ? (
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1db954]/20 flex items-center justify-center border border-[#1db954]/40 shadow-[0_0_30px_rgba(29,185,84,0.2)] animate-pulse">
            <Music className="w-8 h-8 text-[#1db954]" />
          </div>
          <span className="text-[10px] text-[#1db954] font-black uppercase tracking-widest">{thought.text || 'Spotify Track'}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 p-6 text-center">
          {isLoading ? (
            <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
          ) : (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center border"
              style={{ backgroundColor: `${config.color}15`, borderColor: `${config.color}30` }}
            >
              <Icon className="w-6 h-6" style={{ color: config.color }} />
            </div>
          )}
          <span className="text-[10px] font-black uppercase tracking-widest leading-tight" style={{ color: config.color }}>
            {thought.author || thought.text || `View on ${config.label}`}
          </span>
        </div>
      )}

      {(thought.author || isLoading) && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-8 pointer-events-none transition-opacity group-hover:opacity-100 opacity-60">
          <p className="text-[10px] text-slate-200 line-clamp-2 leading-tight font-black uppercase tracking-wider italic">
            {isLoading ? 'Fetching metadata...' : thought.author}
          </p>
        </div>
      )}
      
      {!previewImage && !isLoading && (
        <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/5 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </div>
      )}
    </div>
  );
};

