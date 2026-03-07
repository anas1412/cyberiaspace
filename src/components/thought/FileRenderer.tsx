import React, { useState, useEffect } from 'react';
import { type Thought } from '../../db';
import { useThoughtPayload } from './hooks/useThoughtPayload';
import { FileText, FileAudio, FileVideo, FileCode, File as FileIcon, Maximize2 } from 'lucide-react';
import { db } from '../../db';

interface FileRendererProps {
  thought: Thought;
}

export const FileRenderer: React.FC<FileRendererProps> = ({ thought }) => {
  const { image, fileInfo } = useThoughtPayload(thought);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  
  useEffect(() => {
    let url: string | null = null;
    const loadLocal = async () => {
      try {
        const entry = await db.blobs.where('thoughtId').equals(thought.id).first();
        if (entry) {
          url = URL.createObjectURL(entry.blob);
          setLocalUrl(url);
        } else {
          setLocalUrl(null);
        }
      } catch (e) {
        console.warn("[FileRenderer] Local blob load failed", e);
      }
    };
    loadLocal();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [thought.id, thought.syncStatus]);

  const fileName = (thought.text || '').toLowerCase();
  const extension = fileName.split('.').pop() || '';
  const mimeType = (fileInfo?.type || '').toLowerCase();
  
  // Robust Audio Detection
  const isAudio = mimeType.startsWith('audio/') || 
                  ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(extension);

  // Robust Video Detection (Exclude Audio)
  const isVideo = (mimeType.startsWith('video/') || 
                  ['mp4', 'webm', 'mov', 'm4v'].includes(extension)) && !isAudio;

  // Robust Image Detection (Strictly image types, exclude Audio/Video)
  const isImage = (mimeType.startsWith('image/') || 
                  ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) && 
                  !isAudio && !isVideo;

  const getFileIcon = () => {
    if (isAudio) return <FileAudio className="w-8 h-8 text-blue-400" />;
    if (isVideo) return <FileVideo className="w-8 h-8 text-purple-400" />;
    if (mimeType.includes('pdf') || extension === 'pdf') return <FileText className="w-8 h-8 text-red-400" />;
    if (mimeType.includes('javascript') || mimeType.includes('typescript') || mimeType.includes('json') || mimeType.includes('code') || 
        ['js', 'ts', 'tsx', 'json', 'css', 'html'].includes(extension)) {
      return <FileCode className="w-8 h-8 text-amber-400" />;
    }
    return <FileIcon className="w-8 h-8 text-slate-400" />;
  };

  const activeSource = localUrl || thought.storageUrl || image;
  const hasContent = !!activeSource;
  
  const hasRemoteContent = thought.storageUrl && !localUrl && thought.syncStatus !== 'synced';

  // MEDIA PREVIEW BLOCK (Images & Videos)
  // Audio files use the list view below to ensure correct icon and prevent video overlay
  if ((isImage || isVideo) && (hasContent || hasRemoteContent)) {
    return (
      <div data-trigger="file" className="mt-2 relative group cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black/50 aspect-video flex items-center justify-center">
        {activeSource ? (
          isVideo ? (
            <video
              src={activeSource}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              muted
              playsInline
              loop
              onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
              onMouseLeave={(e) => e.currentTarget.pause()}
            />
          ) : (
            <img
              src={activeSource}
              draggable="false"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              alt={thought.text}
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-2 opacity-20 animate-pulse">
            <Maximize2 className="w-6 h-6 text-white" />
          </div>
        )}

        {/* Video Overlay Icon - ONLY for actual videos, never audio */}
        {isVideo && !isAudio && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-[var(--accent)]/40 transition-all duration-300">
              <FileVideo className="w-5 h-5 text-white shadow-2xl" />
            </div>
          </div>
        )}

        {/* Hover View Action for Images */}
        {activeSource && !isVideo && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <Maximize2 className="w-6 h-6 text-white" />
          </div>
        )}

        {/* Type Badge */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[7px] font-black text-white/60 uppercase tracking-widest">
          {mimeType.split('/')[1]?.toUpperCase() || extension.toUpperCase() || 'DATA'}
        </div>
      </div>
    );
  }

  // LIST STYLE VIEW (Audio, Docs, etc.)
  const fileSizeStr = fileInfo?.size 
    ? (fileInfo.size > 1024 * 1024 
        ? `${(fileInfo.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${(fileInfo.size / 1024).toFixed(1)} KB`)
    : '';

  return (
    <div 
      data-trigger="file"
      className="mt-2 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group flex items-center gap-4 relative overflow-hidden"
    >
      <div className="w-14 h-14 rounded-xl bg-black/20 flex items-center justify-center border border-white/5 shadow-inner">
        {getFileIcon()}
      </div>
      <div className="flex-1 overflow-hidden">
        <h4 className="text-[11px] font-black uppercase tracking-widest text-white truncate mb-1">
          {thought.text || 'Untitled File'}
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
            {mimeType.split('/')[1]?.toUpperCase() || extension.toUpperCase() || 'FILE'}
          </span>
          {fileSizeStr && (
            <span className="text-[9px] font-medium text-slate-600">
              • {fileSizeStr}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileRenderer;
