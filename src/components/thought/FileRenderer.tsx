import React from 'react';
import { type Thought } from '../../db';
import { FileText, Download, FileAudio, FileVideo, FileCode, File as FileIcon, Maximize2, RefreshCw } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FileRendererProps {
  thought: Thought;
}

export const FileRenderer: React.FC<FileRendererProps> = ({ thought }) => {
  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="w-8 h-8 text-red-400" />;
    if (type.includes('audio') || type.includes('mp3')) return <FileAudio className="w-8 h-8 text-blue-400" />;
    if (type.includes('video') || type.includes('mp4')) return <FileVideo className="w-8 h-8 text-purple-400" />;
    if (type.includes('javascript') || type.includes('typescript') || type.includes('json') || type.includes('code')) return <FileCode className="w-8 h-8 text-amber-400" />;
    return <FileIcon className="w-8 h-8 text-slate-400" />;
  };

  const fileMeta = thought.meta?.file || {};
  const isImage = fileMeta.type?.startsWith('image/') || thought.image || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(thought.text?.toLowerCase().split('.').pop() || '');
  const isVideo = fileMeta.type?.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v'].includes(thought.text?.toLowerCase().split('.').pop() || '');
  const hasRemoteContent = thought.storageUrl && thought.syncStatus !== 'synced';
  const isSyncing = thought.syncStatus === 'syncing' || thought.syncStatus === 'pending';

  if ((isImage || isVideo) && (thought.image || hasRemoteContent)) {
    return (
      <div data-trigger="file" className="mt-2 relative group cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black/50 aspect-video flex items-center justify-center">
        {thought.image ? (
          <img
            src={thought.image}
            draggable="false"
            className={cn(
              "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500",
              isSyncing && "opacity-40 grayscale"
            )}
            alt={thought.text}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 opacity-20 animate-pulse">
            <Maximize2 className="w-6 h-6 text-white" />
            <span className="text-[8px] font-black uppercase tracking-widest text-amber-500 text-center px-4">
              Pending Sync...
            </span>
          </div>
        )}

        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-purple-500/40 transition-all duration-300">
              <FileVideo className="w-5 h-5 text-white shadow-2xl" />
            </div>
          </div>
        )}

        {!isVideo && (
          <div className={cn(
            "absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 transition-opacity",
            (thought.image && !isSyncing) ? "opacity-0 group-hover:opacity-100" : isSyncing ? "opacity-0" : "opacity-100"
          )}>
            <Maximize2 className="w-6 h-6 text-white" />
            <span className="text-[8px] font-black uppercase tracking-widest text-white/80">
              {hasRemoteContent && !thought.image ? 'Device Link Required' : 'View Asset'}
            </span>
          </div>
        )}

        {isSyncing && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-blue-500/5 backdrop-blur-[2px]">
            <div className="relative">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
              <div className="absolute inset-0 bg-blue-400/20 blur-md rounded-full animate-pulse" />
            </div>
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-400/80">Securing to Cloud</span>
          </div>
        )}

        {/* Type Badge */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[7px] font-black text-white/60 uppercase tracking-widest">
          {fileMeta.type?.split('/')[1]?.toUpperCase() || thought.text?.split('.').pop()?.toUpperCase() || 'IMG'}
        </div>
      </div>
    );
  }

  const fileSizeStr = fileMeta.size 
    ? (fileMeta.size > 1024 * 1024 
        ? `${(fileMeta.size / (1024 * 1024)).toFixed(1)} MB` 
        : `${(fileMeta.size / 1024).toFixed(1)} KB`)
    : '';

  return (
    <div 
      data-trigger="file"
      className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group flex items-center gap-4 relative overflow-hidden"
    >
      {isSyncing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 bg-blue-500/10 backdrop-blur-[2px]">
          <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-400">Syncing...</span>
        </div>
      )}
      <div className={cn("w-14 h-14 rounded-xl bg-black/20 flex items-center justify-center border border-white/5 shadow-inner", isSyncing && "opacity-20")}>
        {getFileIcon(fileMeta.type || '')}
      </div>
      <div className={cn("flex-1 overflow-hidden", isSyncing && "opacity-20")}>
        <h4 className="text-[11px] font-black uppercase tracking-widest text-white truncate mb-1">
          {thought.text || 'Untitled File'}
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
            {fileMeta.type?.split('/')[1]?.toUpperCase() || 'FILE'}
          </span>
          {fileSizeStr && (
            <span className="text-[9px] font-medium text-slate-600">
              • {fileSizeStr}
            </span>
          )}
        </div>
      </div>
      <div className={cn("w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity", isSyncing && "hidden")}>
        <Download className="w-3.5 h-3.5 text-blue-400" />
      </div>
    </div>
  );
};
