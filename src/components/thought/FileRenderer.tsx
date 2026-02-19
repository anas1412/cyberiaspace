import React from 'react';
import { type Thought } from '../../db';
import { FileText, Download, FileAudio, FileVideo, FileCode, File as FileIcon } from 'lucide-react';

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
      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Download className="w-3.5 h-3.5 text-indigo-400" />
      </div>
    </div>
  );
};
