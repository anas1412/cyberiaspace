import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { File as FileIcon, Upload, Download, Loader2, FileAudio, Globe, Shield, ExternalLink } from 'lucide-react';
import { FocusEditorShell } from './FocusEditorShell';
import { driveService } from '../../services/google/driveService';
import { useGoogleLogin } from '@react-oauth/google';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const EditorContent: React.FC<{
  thought: any;
  fileMeta: any;
  localPreviewUrl: string | null;
  accessToken: string | null;
  isUploading: boolean;
  error: string | null;
  hasDriveAccess: boolean;
  driveLogin: () => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  stackItems: any[];
  setActiveFocus: (id: number | null, type: any) => void;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  stack: any;
}> = ({ 
  thought, fileMeta, localPreviewUrl, accessToken, isUploading, error,
  hasDriveAccess, driveLogin, handleFileSelect, 
  stackItems, setActiveFocus, scrollerRef, stack 
}) => (
  <div className="flex-1 flex flex-col min-h-0 bg-black">
    {/* Preview Area */}
    <div className="flex-1 relative min-h-0">
      {(thought.driveFileId || localPreviewUrl) ? (
        <div className="absolute inset-0 flex items-center justify-center">
          {fileMeta.type?.includes('pdf') || thought.text?.toLowerCase().endsWith('.pdf') ? (
            <iframe 
              src={localPreviewUrl ? `${localPreviewUrl}#toolbar=0&navpanes=0&scrollbar=0` : `https://drive.google.com/file/d/${thought.driveFileId}/preview`} 
              className="w-full h-full border-none bg-white"
              title="PDF Preview"
            />
          ) : fileMeta.type?.includes('audio') || thought.text?.toLowerCase().endsWith('.mp3') || thought.text?.toLowerCase().endsWith('.wav') || thought.text?.toLowerCase().endsWith('.ogg') ? (
            <div className="flex flex-col items-center justify-center w-full h-full p-8 bg-[#020408]">
              <div className="relative mb-12">
                <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-3xl animate-pulse scale-150" />
                <div className="relative w-32 h-32 md:w-40 md:h-40 bg-indigo-500/5 rounded-full flex items-center justify-center border border-indigo-500/10 shadow-[0_0_80px_rgba(99,102,241,0.2)]">
                  <FileAudio className="w-16 h-12 md:w-20 md:h-16 text-indigo-400 opacity-60" />
                </div>
              </div>
              
              <div className="w-full max-w-lg glass p-4 md:p-6 rounded-[2.5rem] border border-white/5 shadow-2xl relative z-10">
                <audio 
                  controls 
                  autoPlay
                  className="w-full h-10 invert brightness-200 hue-rotate-[240deg]"
                  src={localPreviewUrl || (accessToken ? `https://www.googleapis.com/drive/v3/files/${thought.driveFileId}?alt=media&access_token=${accessToken}` : undefined)}
                />
              </div>
            </div>
          ) : fileMeta.type?.includes('video') || thought.text?.toLowerCase().endsWith('.mp4') || thought.text?.toLowerCase().endsWith('.mov') || thought.text?.toLowerCase().endsWith('.webm') ? (
            <video 
              controls 
              autoPlay
              className="w-full h-full object-contain bg-black"
              src={localPreviewUrl || (accessToken ? `https://www.googleapis.com/drive/v3/files/${thought.driveFileId}?alt=media&access_token=${accessToken}` : undefined)}
            />
          ) : (
            <div className="flex flex-col items-center gap-8 p-12">
              <div className="w-32 h-32 bg-white/5 rounded-[2.5rem] border border-white/10 flex items-center justify-center shadow-inner">
                <FileIcon className="w-16 h-16 text-slate-500" />
              </div>
              <div className="text-center">
                <h4 className="text-2xl font-black uppercase tracking-widest text-white mb-3">{thought.text || fileMeta.name}</h4>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                  Preview not available for this format.<br/>Download to view on your system.
                </p>
              </div>
            </div>
          )}

          {isUploading && (
            <div className="absolute top-6 right-6 px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full flex items-center gap-3 z-20">
              <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Syncing to Cloud...</span>
            </div>
          )}
        </div>
      ) : !hasDriveAccess ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020408] p-8 text-center">
          <div className="w-24 h-24 bg-indigo-500/5 rounded-[2rem] border border-indigo-500/10 flex items-center justify-center mb-8 shadow-2xl">
            <Shield className="w-10 h-10 text-indigo-400 opacity-40" />
          </div>
          <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white mb-3">Cloud Backup</h3>
          <p className="text-xs font-medium text-slate-500 max-w-xs leading-relaxed mb-8 uppercase tracking-widest">
            Connect Google Drive to store large files securely in your private cloud.
          </p>
          <button 
            onClick={driveLogin}
            className="inline-flex items-center gap-3 px-8 py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <Globe className="w-4 h-4" />
            Enable Drive Sync
          </button>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020408] p-8 text-center">
          <div className="w-24 h-24 bg-white/5 rounded-[2rem] border border-white/10 flex items-center justify-center mb-8 shadow-2xl relative group">
            <Upload className="w-10 h-10 text-slate-500 group-hover:text-indigo-400 transition-colors" />
            {isUploading && (
              <div className="absolute inset-0 bg-black/60 rounded-[2rem] flex items-center justify-center backdrop-blur-sm">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              </div>
            )}
          </div>
          <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white mb-3">Empty Slot</h3>
          <p className="text-xs font-medium text-slate-500 leading-relaxed mb-8 uppercase tracking-widest">
            Drop a file or select one to begin.
          </p>
          
          <label className={cn(
            "inline-flex items-center gap-3 px-8 py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer shadow-lg shadow-indigo-500/20 active:scale-95",
            isUploading && "opacity-50 pointer-events-none"
          )}>
            <Upload className="w-4 h-4" />
            {isUploading ? 'Preparing...' : 'Select File'}
            <input type="file" className="hidden" onChange={handleFileSelect} disabled={isUploading} />
          </label>

          {error && <p className="mt-6 text-[10px] font-bold text-red-400 uppercase tracking-widest">{error}</p>}
        </div>
      )}
    </div>

    {/* Collection Carousel */}
    <AnimatePresence>
      {stackItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/40 backdrop-blur-md border-t border-white/5 p-4 md:p-6"
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Collection: {stack?.name}</span>
            <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">{stackItems.length + 1} items total</span>
          </div>
          <div className="flex gap-3 overflow-x-auto custom-scroll pb-2 w-full snap-x" ref={scrollerRef}>
            {stackItems.map((item) => {
              const itemMeta = item.meta?.file || {};
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveFocus(item.id, 'file')}
                  className="flex-shrink-0 w-32 md:w-40 aspect-video rounded-xl overflow-hidden border border-white/5 hover:border-[var(--accent)]/50 transition-all group/item snap-start relative bg-white/[0.02]"
                >
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2">
                    {itemMeta.type?.includes('pdf') ? <FileIcon className="w-6 h-6 text-red-400 opacity-40 group-hover/item:opacity-100" /> : 
                     itemMeta.type?.includes('audio') ? <FileAudio className="w-6 h-6 text-blue-400 opacity-40 group-hover/item:opacity-100" /> :
                     <FileIcon className="w-6 h-6 text-slate-500 opacity-40 group-hover/item:opacity-100" />}
                    <p className="text-[8px] font-bold text-slate-500 group-hover/item:text-white truncate w-full text-center px-2">{item.text || "Untitled"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const FileFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const updateThought = useStore((state) => state.updateThought);
  const isReadOnly = useStore((state) => state.isReadOnly);
  
  const accessToken = useAuthStore((state) => state.accessToken);
  const grantedScopes = useAuthStore((state) => state.grantedScopes);
  const requestServiceAccess = useAuthStore((state) => state.requestServiceAccess);

  const hasDriveAccess = grantedScopes.includes('https://www.googleapis.com/auth/drive.file');

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localTitle, setLocalTitle] = useState('');
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  const thought = thoughts.find((t) => t.id === activeFocusId);
  const stack = stacks.find((s) => s.id === thought?.stackId);
  const isVisible = focusType === 'file' && !!thought;

  const fileMeta = thought?.meta?.file || {};

  const scrollerRef = useRef<HTMLDivElement>(null);

  const stackItems = useMemo(() => {
    if (!thought?.stackId) return [];
    return thoughts.filter(t => t.stackId === thought.stackId && t.id !== thought.id && t.type === 'file');
  }, [thoughts, thought]);

  // Load local blob preview if exists
  useEffect(() => {
    let url: string | null = null;
    if (isVisible && thought) {
      const loadLocalBlob = async () => {
        const { db } = await import('../../db');
        const entry = await db.blobs.where('thoughtId').equals(thought.id).first();
        if (entry) {
          url = URL.createObjectURL(entry.blob);
          setLocalPreviewUrl(url);
        }
      };
      loadLocalBlob();
    }
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
        setLocalPreviewUrl(null);
      }
    };
  }, [isVisible, thought?.id]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { if (e.deltaY === 0) return; e.preventDefault(); el.scrollLeft += e.deltaY; };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isVisible, stackItems.length]);

  // Google Login hook for Drive access on-demand
  const driveLogin = useGoogleLogin({
    onSuccess: (response: any) => {
      if (response.access_token) {
        requestServiceAccess('https://www.googleapis.com/auth/drive.file', response.access_token);
      }
    },
    scope: [...grantedScopes, 'https://www.googleapis.com/auth/drive.file'].join(' '),
    flow: 'implicit'
  } as any);

  useEffect(() => {
    if (thought) {
      setLocalTitle(thought.text);
    }
  }, [activeFocusId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !thought) return;
    await uploadToDrive(file);
  };

  const uploadToDrive = async (file: File) => {
    if (!accessToken) {
      setError('Please sign in to upload files to Google Drive.');
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const { db } = await import('../../db');
      await db.blobs.put({
        id: `local-${Date.now()}`,
        thoughtId: thought!.id,
        blob: file,
        name: file.name,
        type: file.type,
        updatedAt: Date.now()
      });

      const url = URL.createObjectURL(file);
      setLocalPreviewUrl(url);

      const folderId = await driveService.ensureRootFolder(accessToken);
      const result = await driveService.uploadFile(accessToken, file, file.name, folderId);
      
      await updateThought(thought!.id, {
        text: file.name,
        type: 'file',
        syncStatus: 'synced',
        driveFileId: result.id,
        meta: {
          ...thought?.meta,
          file: {
            id: result.id,
            name: result.name,
            size: file.size,
            type: file.type,
            link: result.webContentLink,
            webViewLink: result.webViewLink
          }
        }
      });
      
      setLocalTitle(file.name);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload to Google Drive');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!thought?.driveFileId && !localPreviewUrl) return;
    try {
      let blob: Blob;
      if (localPreviewUrl) {
        const { db } = await import('../../db');
        const entry = await db.blobs.where('thoughtId').equals(thought!.id).first();
        if (!entry) throw new Error('Local file not found');
        blob = entry.blob;
      } else {
        if (!accessToken) throw new Error('Auth required for cloud download');
        blob = await driveService.downloadFile(accessToken, thought!.driveFileId!);
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = thought!.text || 'file';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  if (!thought) return null;

  return (
    <FocusEditorShell
      isVisible={isVisible}
      onClose={() => setActiveFocus(null, null)}
      icon={FileIcon}
      title={localTitle}
      onTitleChange={(val: string) => {
        setLocalTitle(val);
        updateThought(thought.id, { text: val });
      }}
      description={thought.description}
      isReadOnly={isReadOnly}
      stack={stack}
      headerActions={
        <div className="flex items-center gap-2">
          {thought.driveFileId && (
            <a 
              href={fileMeta.webViewLink || `https://drive.google.com/file/d/${thought.driveFileId}/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 md:p-4 hover:bg-white/5 rounded-xl md:rounded-2xl text-slate-400 hover:text-white transition-all"
              title="Open in Drive"
            >
              <ExternalLink className="w-5 h-5 md:w-6 md:h-6" />
            </a>
          )}
        </div>
      }
      footerStatus={
        <p className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-slate-600 italic">
          {thought.syncStatus === 'synced' ? 'Synced to Google Drive' : 'Stored in Local Buffer'}
        </p>
      }
      footerActions={
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-6 px-4">
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Mass</p>
              <p className="text-[10px] font-black text-white">
                {fileMeta.size ? (fileMeta.size > 1024 * 1024 ? `${(fileMeta.size / (1024 * 1024)).toFixed(2)} MB` : `${(fileMeta.size / 1024).toFixed(2)} KB`) : '0.00 KB'}
              </p>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Format</p>
              <p className="text-[10px] font-black text-white uppercase tracking-widest">
                {fileMeta.type?.split('/')[1]?.toUpperCase() || thought.text?.split('.').pop()?.toUpperCase() || 'DATA'}
              </p>
            </div>
          </div>

          {(thought.driveFileId || localPreviewUrl) && (
            <button 
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          )}
        </div>
      }
    >
      <EditorContent 
        thought={thought}
        fileMeta={fileMeta}
        localPreviewUrl={localPreviewUrl}
        accessToken={accessToken}
        isUploading={isUploading}
        error={error}
        hasDriveAccess={hasDriveAccess}
        driveLogin={driveLogin}
        handleFileSelect={handleFileSelect}
        stackItems={stackItems}
        setActiveFocus={setActiveFocus}
        scrollerRef={scrollerRef}
        stack={stack}
      />
    </FocusEditorShell>
  );
};

export default FileFocusEditor;
