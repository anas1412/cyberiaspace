import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { File as FileIcon, Upload, Download, Loader2, FileAudio, Shield, Database, CloudOff, Cloud } from 'lucide-react';
import { FocusEditorShell } from './FocusEditorShell';
import { MAX_FILE_SIZE_MB } from '../../constants';
import { generateThumbnail } from '../../utils/image';
import { supabaseStorage } from '../../services/supabaseStorage';
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
  isUploading: boolean;
  isFetching: boolean;
  error: string | null;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  stackItems: any[];
  setActiveFocus: (id: number | null, type: any) => void;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  stack: any;
}> = ({ 
  thought, fileMeta, localPreviewUrl, isUploading, isFetching, error,
  handleFileSelect, 
  stackItems, setActiveFocus, scrollerRef, stack 
}) => {
  const isStranded = !thought.storageUrl && !localPreviewUrl && !thought.image && thought.syncStatus !== 'synced';

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-black">
      <div className="flex-1 relative min-h-0">
        {isFetching ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020408] gap-4">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Retrieving Data...</p>
          </div>
        ) : isStranded ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020408] p-8 text-center gap-6">
            <div className="w-24 h-24 bg-amber-500/5 rounded-[2rem] border border-amber-500/10 flex items-center justify-center shadow-2xl relative">
              <Database className="w-10 h-10 text-amber-500 opacity-40" />
              <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-1 border border-amber-500/20">
                <CloudOff className="w-4 h-4 text-amber-500" />
              </div>
            </div>
            <div className="max-w-xs">
              <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white mb-3">Sync Pending</h3>
              <p className="text-xs font-medium text-slate-500 leading-relaxed mb-8 uppercase tracking-widest text-center">
                This content exists only on your other device. Please sync that device to the cloud to access it here.
              </p>
            </div>
          </div>
        ) : (thought.storageUrl || localPreviewUrl || thought.image) ? (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            {fileMeta.type?.includes('pdf') || thought.text?.toLowerCase().endsWith('.pdf') ? (
              <iframe 
                src={localPreviewUrl || thought.storageUrl}
                className="w-full h-full border-none bg-white rounded-xl shadow-2xl"
                title="PDF Preview"
              />
            ) : fileMeta.type?.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(thought.text?.toLowerCase().split('.').pop() || '') || thought.type === 'image' ? (
              <div className="flex flex-col items-center justify-center w-full h-full p-4 md:p-8">
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl">
                  <img 
                    src={localPreviewUrl || thought.storageUrl || thought.image}
                    alt={thought.text}
                    className="max-w-full max-h-full object-contain shadow-2xl transition-opacity duration-300"
                    style={{ opacity: isFetching ? 0.5 : 1 }}
                  />
                </div>
              </div>
            ) : fileMeta.type?.includes('audio') || thought.text?.toLowerCase().endsWith('.mp3') || thought.text?.toLowerCase().endsWith('.wav') || thought.text?.toLowerCase().endsWith('.ogg') ? (
              <div className="flex flex-col items-center justify-center w-full h-full p-8 bg-[#020408]">
                <div className="relative mb-12">
                  <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-3xl animate-pulse scale-150" />
                  <div className="relative w-32 h-32 md:w-40 md:h-40 bg-blue-500/5 rounded-full flex items-center justify-center border border-blue-500/10 shadow-[0_0_80px_rgba(99,102,241,0.2)]">
                    <FileAudio className="w-16 h-12 md:w-20 md:h-16 text-blue-400 opacity-60" />
                  </div>
                </div>
                <div className="w-full max-w-lg glass p-4 md:p-6 rounded-[2.5rem] border border-white/5 shadow-2xl relative z-10">
                  <audio 
                    controls 
                    autoPlay 
                    className="w-full h-10 invert brightness-200 hue-rotate-[240deg]"
                    src={localPreviewUrl || thought.storageUrl}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <FileIcon className="w-24 h-24 text-slate-600 mb-4" />
                <p className="text-slate-500 text-sm">Preview not available</p>
              </div>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020408] p-8 text-center">
            <div className="w-24 h-24 bg-white/5 rounded-[2rem] border border-white/10 flex items-center justify-center mb-8 shadow-2xl relative group">
              <Upload className="w-10 h-10 text-slate-500 group-hover:text-blue-400 transition-colors" />
              {isUploading && (
                <div className="absolute inset-0 bg-black/60 rounded-[2rem] flex items-center justify-center backdrop-blur-sm">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                </div>
              )}
            </div>
            <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white mb-3">Empty Slot</h3>
            <p className="text-xs font-medium text-slate-500 leading-relaxed mb-8 uppercase tracking-widest">
              Drop a file or select one to begin.
            </p>
            <label className={cn(
              "inline-flex items-center gap-3 px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer shadow-lg shadow-blue-500/20 active:scale-95",
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
                const isItemImage = item.type === 'image' || itemMeta.type?.startsWith('image/');
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveFocus(item.id, item.type)}
                    className="flex-shrink-0 w-32 md:w-40 aspect-video rounded-xl overflow-hidden border border-white/5 hover:border-[var(--accent)]/50 transition-all group/item snap-start relative bg-white/[0.02]"
                  >
                    <div className="w-full h-full flex flex-col items-center justify-center relative">
                      {isItemImage && item.image ? (
                        <img src={item.image} className="w-full h-full object-cover opacity-40 group-hover/item:opacity-100 transition-opacity" alt={item.text} />
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 p-2">
                          {itemMeta.type?.includes('pdf') ? <FileIcon className="w-6 h-6 text-red-400 opacity-40 group-hover/item:opacity-100" /> : 
                           itemMeta.type?.includes('audio') ? <FileAudio className="w-6 h-6 text-blue-400 opacity-40 group-hover/item:opacity-100" /> :
                           <FileIcon className="w-6 h-6 text-slate-500 opacity-40 group-hover/item:opacity-100" />}
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-[8px] font-bold text-slate-300 group-hover/item:text-white truncate w-full text-center">{item.text || "Untitled"}</p>
                      </div>
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
};

const FileFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const updateThought = useStore((state) => state.updateThought);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  
  const { user } = useAuthStore();

  const thought = useMemo(() => {
    if (focusType === 'file' || focusType === 'image') {
      return thoughts.find(t => t.id === activeFocusId);
    }
    return null;
  }, [activeFocusId, focusType, thoughts]);

  const stack = useMemo(() => {
    if (!thought?.stackId) return null;
    return stacks.find(s => s.id === thought.stackId);
  }, [thought, stacks]);

  const stackItems = useMemo(() => {
    if (!stack) return [];
    return thoughts.filter(t => t.stackId === stack.id && t.id !== thought?.id);
  }, [stack, thoughts, thought]);

  const [localTitle, setLocalTitle] = useState('');
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const isVisible = !!thought;
  const isReadOnly = false;

  const fileMeta = useMemo(() => {
    if (!thought) return {};
    return thought.meta?.file || {};
  }, [thought]);

  useEffect(() => {
    if (!scrollerRef.current || !isVisible || stackItems.length === 0) return;
    const el = scrollerRef.current;
    const onWheel = (e: WheelEvent) => { if (e.deltaY === 0) return; e.preventDefault(); el.scrollLeft += e.deltaY; };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isVisible, stackItems.length]);

  useEffect(() => {
    if (thought) {
      setLocalTitle(thought.text);
    }
  }, [activeFocusId, thought?.text]);

  useEffect(() => {
    const loadLocalBlob = async () => {
      if (!thought) return;
      if (thought.storageUrl || localPreviewUrl) return;
      if (thought.type !== 'file' && thought.type !== 'image') return;
      
      try {
        const { db: database } = await import('../../db');
        const blobEntry = await database.blobs.where('thoughtId').equals(thought.id).first();
        
        if (blobEntry?.blob) {
          const url = URL.createObjectURL(blobEntry.blob);
          setLocalPreviewUrl(url);
        }
      } catch (err) {
        console.error('Failed to load local blob:', err);
      }
    };
    
    loadLocalBlob();
  }, [thought?.id, thought?.storageUrl, thought?.type]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !thought || !user) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Maximum allowed size is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const { db: database } = await import('../../db');
      
      await database.blobs.put({
        id: `local-${Date.now()}`,
        thoughtId: thought.id,
        blob: file,
        name: file.name,
        type: file.type,
        updatedAt: Date.now()
      });

      const url = URL.createObjectURL(file);
      setLocalPreviewUrl(url);

      const result = await supabaseStorage.uploadFile(user.id, file, file.name);
      
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
      const thumbnail = isImage ? await generateThumbnail(file).catch(() => null) : null;
      
      await updateThought(thought.id, {
        text: file.name,
        type: isImage ? 'image' : 'file',
        image: thumbnail || null,
        syncStatus: 'synced',
        storageUrl: result.url,
        storagePath: result.path,
      });
      
      setLocalTitle(file.name);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!thought?.storageUrl && !localPreviewUrl) return;
    try {
      let blob: Blob;
      if (localPreviewUrl) {
        const { db: database } = await import('../../db');
        const entry = await database.blobs.where('thoughtId').equals(thought!.id).first();
        if (!entry) throw new Error('Local file not found');
        blob = entry.blob;
      } else if (thought?.storagePath) {
        const signedUrl = await supabaseStorage.getSignedUrl(thought.storagePath);
        const response = await fetch(signedUrl);
        blob = await response.blob();
      } else {
        throw new Error('No file available');
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
          {(!thought.storageUrl && localPreviewUrl && !isUploading) && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <Shield className="w-3 h-3 text-amber-500" />
              <span className="text-[8px] font-black uppercase tracking-widest text-amber-500">Stored Locally</span>
            </div>
          )}
          {thought.storageUrl && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <Cloud className="w-3 h-3 text-blue-500" />
              <span className="text-[8px] font-black uppercase tracking-widest text-blue-500">Cloud Synced</span>
            </div>
          )}
        </div>
      }
      footerStatus={
        <p className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-slate-600 italic">
          {thought.syncStatus === 'synced' ? 'Synced to Cloud' : 'Stored in Local Buffer'}
        </p>
      }
      footerActions={
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-6 px-4">
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Mass</p>
              <p className="text-[10px] font-black text-white">
                {fileMeta.size ? (fileMeta.size > 1024 * 1024 ? `${(fileMeta.size / (1024 * 1024)).toFixed(2)} MB` : `${(fileMeta.size / 1024).toFixed(2)} KB`) : (thought.image ? 'IMAGE' : '0.00 KB')}
              </p>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Format</p>
              <p className="text-[10px] font-black text-white uppercase tracking-widest">
                {fileMeta.type?.split('/')[1]?.toUpperCase() || thought.text?.split('.').pop()?.toUpperCase() || (thought.image ? 'IMAGE' : 'DATA')}
              </p>
            </div>
          </div>

          {(thought.storageUrl || localPreviewUrl) && (
            <button 
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95"
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
        isUploading={isUploading}
        isFetching={false}
        error={error}
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
