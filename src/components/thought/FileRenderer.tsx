import React from 'react';
import { type Thought } from '../../db';
import { FileText, Download, FileAudio, FileVideo, FileCode, File as FileIcon, Maximize2 } from 'lucide-react';
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
  const isStranded = !thought.driveFileId && thought.syncStatus !== 'synced';

  if (isImage && (thought.image || isStranded)) {
    return (
      <div data-trigger="file" className="mt-2 relative group cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black/50 aspect-video flex items-center justify-center">
        {thought.image ? (
          <img
            src={thought.image}
            draggable="false"
            className="w-full h-full object-cover cursor-zoom-in group-hover:scale-105 transition-transform duration-500"
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
        <div className={cn(
          "absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 transition-opacity",
          thought.image ? "opacity-0 group-hover:opacity-100" : "opacity-100"
        )}>
          <Maximize2 className="w-6 h-6 text-white" />
          <span className="text-[8px] font-black uppercase tracking-widest text-white/80">
            {isStranded && !thought.image ? 'Device Link Required' : 'View Asset'}
          </span>
        </div>
        
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
      className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group flex items-center gap-4"
    >
      <div className="w-14 h-14 rounded-xl bg-black/20 flex items-center justify-center border border-white/5 shadow-inner">
        {getFileIcon(fileMeta.type || '')}
      </div>
      <div className="flex-1 overflow-hidden">
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
      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Download className="w-3.5 h-3.5 text-blue-400" />
      </div>
    </div>
  );
};
