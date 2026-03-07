import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useSyncStore } from '../../store/useSyncStore';
import { useThoughtPayload } from '../thought/hooks/useThoughtPayload';
import { useModalStore } from '../../store/useModalStore';
import { 
  File as FileIcon, Upload, Download, Loader2, FileAudio, 
  Database, CloudOff, Cloud, ExternalLink, Shield 
} from 'lucide-react';
import { FocusEditorShell } from './FocusEditorShell';
import { MAX_FILE_SIZE_MB } from '../../constants';
import { generateThumbnail, generateVideoThumbnail } from '../../utils/image';
import { AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from '../../db';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const StackItemThumbnail: React.FC<{ 
  item: any; 
  onClick: () => void;
}> = ({ item, onClick }) => {
  const itemPayload = useThoughtPayload(item);
  const thumb = itemPayload.image;
  
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-32 md:w-40 aspect-video rounded-xl overflow-hidden border border-white/5 hover:border-[var(--accent)]/50 transition-all group/item snap-start relative bg-white/[0.02]"
    >
      {thumb ? (
        <img src={thumb} alt={item.text} className="w-full h-full object-cover opacity-50 group-hover/item:opacity-100 transition-opacity" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <FileIcon className="w-5 h-5 opacity-20 text-slate-400" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity flex items-end p-2 text-left">
        <p className="text-[8px] font-bold text-white truncate w-full">{item.text || "Untitled"}</p>
      </div>
    </button>
  );
};

const EditorContent: React.FC<{
  thought: any;
  fileInfo: any;
  image: string | null;
  localPreviewUrl: string | null;
  isUploading: boolean;
  isFetching: boolean;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  stackItems: any[];
  setActiveFocus: (id: number | null, type: any) => void;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  stack: any;
}> = ({ 
  thought, fileInfo, image, localPreviewUrl, isUploading, isFetching,
  handleFileSelect, 
  stackItems, setActiveFocus, scrollerRef, stack 
}) => {
  const isStranded = !thought.storageUrl && !localPreviewUrl && !image && !!thought.storagePath;

  // Robust type detection using fileInfo and extension
  const fileName = (fileInfo?.name || thought.text || '').toLowerCase();
  const mimeType = (fileInfo?.type || '').toLowerCase();
  const extension = fileName.split('.').pop() || '';
  
  const isLocalOnly = thought.syncStatus === 'local' || thought.syncStatus === 'error';
  const activeSource = isLocalOnly ? localPreviewUrl : (localPreviewUrl || thought.storageUrl || image);

  const isPdf = mimeType.includes('pdf') || extension === 'pdf';
  const isVideo = mimeType.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v'].includes(extension);
  const isAudio = mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(extension);
  
  // Special handling for images including "Pasted Image" fallback
  const isImage = mimeType.startsWith('image/') || 
                  ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension) || 
                  fileName.includes('pasted_image') ||
                  (!!activeSource && !isPdf && !isVideo && !isAudio && fileName.includes('image'));

  console.log('[FileFocus] Type Detection:', { 
    fileName, 
    mimeType, 
    isImage, 
    isPdf, 
    isVideo,
    activeSource: !!activeSource 
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-black">
      <div className="flex-1 relative min-h-0">
        {isFetching && !activeSource ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020408] gap-4">
            <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">Retrieving Data...</p>
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
        ) : activeSource ? (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            {isPdf ? (
              <iframe 
                src={activeSource}
                className="w-full h-full border-none bg-white rounded-xl shadow-2xl"
                title="PDF Preview"
              />
            ) : isImage ? (
              <div className="flex flex-col items-center justify-center w-full h-full p-4 md:p-8">
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl">
                  <img 
                    src={activeSource}
                    alt={thought.text}
                    className="max-w-full max-h-full object-contain shadow-2xl transition-opacity duration-300"
                    style={{ opacity: isFetching ? 0.5 : 1 }}
                  />
                </div>
              </div>
            ) : isVideo ? (
              <div className="flex flex-col items-center justify-center w-full h-full p-4 md:p-8">
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl bg-black shadow-2xl">
                  <video 
                    src={activeSource}
                    poster={image || undefined}
                    controls
                    playsInline
                    loop
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            ) : isAudio ? (
              <div className="flex flex-col items-center justify-center w-full h-full p-4 md:p-8">
                <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden rounded-2xl bg-[#020408] shadow-2xl">
                  <div className="flex-1 flex items-center justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-3xl animate-pulse scale-150" />
                      <div className="relative w-32 h-32 md:w-40 md:h-40 bg-blue-500/5 rounded-full flex items-center justify-center border border-blue-500/10">
                        <FileAudio className="w-16 h-12 md:w-20 md:h-16 text-blue-400 opacity-60" />
                      </div>
                    </div>
                  </div>
                  <div className="w-full p-6 md:p-10 bg-black/40 backdrop-blur-xl border-t border-white/5">
                    <audio 
                      controls 
                      autoPlay 
                      className="w-full h-10 invert brightness-200 hue-rotate-[240deg]"
                      src={activeSource}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <FileIcon className="w-24 h-24 text-slate-600 mb-4" />
                <p className="text-slate-500 text-sm font-medium uppercase tracking-widest opacity-50">Preview not available for this format</p>
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
              Upload Asset
              <input type="file" className="hidden" onChange={handleFileSelect} disabled={isUploading} />
            </label>
          </div>
        )}
      </div>

      <AnimatePresence>
        {stackItems.length > 0 && (
          <div className="bg-black/40 backdrop-blur-md border-t border-white/5 p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Collection: {stack?.name}</span>
              <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">{stackItems.length + 1} items total</span>
            </div>
            <div className="flex gap-3 overflow-x-auto custom-scroll pb-2 w-full snap-x" ref={scrollerRef}>
              {stackItems.map((item) => (
                <StackItemThumbnail 
                  key={item.id} 
                  item={item} 
                  onClick={() => setActiveFocus(item.id, 'file')} 
                />
              ))}
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FileFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const isSyncBlocked = useSyncStore((state) => state.isSyncBlocked);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const updateThought = useStore((state) => state.updateThought);
  const isReadOnly = useStore((state) => state.isReadOnly);
  const { 
    uploadThoughtBlob, 
    removeCloudAsset, 
    autoSync, 
    setAutoSync,
    status: authStatus 
  } = useAuthStore();
  const openModal = useModalStore(state => state.openModal);

  const thought = thoughts.find((t) => t.id === activeFocusId);
  const { image, fileInfo } = useThoughtPayload(thought);
  const stack = stacks.find((s) => s.id === thought?.stackId);
  const isVisible = focusType === 'file' && !!thought;

  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // RESET LOGIC: When thought ID changes, clear state and revoke URLs
  useEffect(() => {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    setLocalPreviewUrl(null);
    setIsFetching(false);
    setIsUploading(false);

    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [thought?.id]);

  const stackItems = useMemo(() => {
    if (!thought?.stackId) return [];
    return thoughts.filter(t => t.stackId === thought.stackId && t.id !== thought.id && t.type === 'file');
  }, [thoughts, thought]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { if (e.deltaY === 0) return; e.preventDefault(); el.scrollLeft += e.deltaY; };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isVisible, stackItems.length]);

  useEffect(() => {
    // Only load if visible, has thought, and NO local URL already set
    if (isVisible && thought && !localPreviewUrl) {
      loadLocalBlob();
    }
  }, [isVisible, thought?.id, localPreviewUrl]);

  const loadLocalBlob = async () => {
    if (!thought) return;
    setIsFetching(true);
    try {
      const blobEntry = await db.blobs.where('thoughtId').equals(thought.id).first();
      if (blobEntry) {
        const url = URL.createObjectURL(blobEntry.blob);
        setLocalPreviewUrl(url);
      } else if (thought.storageUrl) {
        // High priority download for focused item
        useAuthStore.getState().downloadSingleBlob(thought.id);
      }
    } catch (e) {
      console.warn("[FileFocus] Local blob load failed", e);
    } finally {
      setIsFetching(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !thought) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      openModal({
        title: 'Incompatible Mass',
        description: `This asset exceeds the ${MAX_FILE_SIZE_MB}MB transmission limit.`,
        type: 'alert',
        confirmText: 'Acknowledged'
      });
      return;
    }

    setIsUploading(true);
    try {
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
      
      const thumbnail = isImage 
        ? await generateThumbnail(file).catch(() => null)
        : isVideo 
          ? await generateVideoThumbnail(file).catch(() => null)
          : null;

      const meta = { ...thought.meta, file: { name: file.name, size: file.size, type: file.type } };

      await updateThought(thought.id, { 
        text: file.name,
        type: 'file',
        data: {
          type: 'file',
          url: thumbnail || '',
          name: file.name,
          size: file.size,
          meta: meta as any
        }
      });

      await db.blobs.put({
        id: `local-${Date.now()}-${thought.id}`,
        thoughtId: thought.id,
        blob: file,
        name: file.name,
        type: file.type,
        updatedAt: Date.now()
      });

      const url = URL.createObjectURL(file);
      setLocalPreviewUrl(url);
      uploadThoughtBlob(thought.id);
    } catch (error) {
      console.error("[FileFocus] Upload failed", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = () => {
    const url = localPreviewUrl || thought?.storageUrl;
    if (!url || !thought) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = thought.text || 'asset';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSyncToCloud = async () => {
    if (!thought || isReadOnly) return;
    
    if (!autoSync) {
      openModal({
        title: 'Enable Auto-Sync?',
        description: 'Auto-sync is currently disabled. Would you like to enable it for all files, or just sync this specific asset once?',
        type: 'confirm_cancel',
        confirmText: 'Enable & Sync',
        cancelText: 'Sync This Only',
        onConfirm: async () => {
          await setAutoSync(true);
          await uploadThoughtBlob(thought.id, true);
        },
        onCancel: async () => {
          await uploadThoughtBlob(thought.id, true);
        }
      });
    } else {
      await uploadThoughtBlob(thought.id, true);
    }
  };

  const handleRemoveFromCloud = () => {
    if (!thought || isReadOnly || !thought.storagePath) return;
    
    openModal({
      title: 'Remove from Cloud?',
      description: 'This will delete the file from cloud storage. A local copy will remain on this device, but it will no longer be available on other devices until re-synced.',
      type: 'confirm_cancel',
      confirmText: 'Remove Asset',
      cancelText: 'Cancel',
      onConfirm: () => removeCloudAsset(thought.id)
    });
  };

  if (!thought) return null;

  const isSynced = thought.syncStatus === 'synced' && !!thought.storageUrl;
  const isSyncing = thought.syncStatus === 'syncing';
  const sourceLabel = localPreviewUrl ? 'Local' : (thought.storageUrl ? 'Cloud' : 'None');

  return (
    <FocusEditorShell
      isVisible={isVisible}
      onClose={() => setActiveFocus(null, null)}
      title={thought.text}
      onTitleChange={(val) => { if (!isReadOnly) updateThought(thought.id, { text: val }); }}
      description={thought.description}
      isReadOnly={isReadOnly}
      stack={stack}
      icon={FileIcon}
      headerActions={
        <div className="flex items-center gap-2">
          {/* Status Badges */}
          <div className="flex items-center gap-2 mr-2">
            {isSynced ? (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <Cloud className="w-3 h-3 text-emerald-400" />
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">Cloud Synced</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Shield className="w-3 h-3 text-blue-400" />
                <span className="text-[8px] font-black uppercase tracking-widest text-blue-400">Local Only</span>
              </div>
            )}
          </div>

          {(localPreviewUrl || thought.storageUrl) && (
            <button onClick={handleDownload} className="p-3 md:p-4 hover:bg-white/5 rounded-xl md:rounded-2xl text-slate-400 hover:text-white transition-all" title="Download Locally">
              <Download className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          )}
          <a href={thought.storageUrl || localPreviewUrl || undefined} target="_blank" rel="noreferrer" className="p-3 md:p-4 hover:bg-white/5 rounded-xl md:rounded-2xl text-slate-400 hover:text-white transition-all" title="Open in New Tab">
            <ExternalLink className="w-5 h-5 md:w-6 md:h-6" />
          </a>
        </div>
      }
      footerStatus={
        <p className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-slate-600 italic">
          <span className="text-slate-500 font-black">SOURCE: {sourceLabel}</span> • {fileInfo?.size ? `${(fileInfo.size / 1024).toFixed(1)}KB` : 'Empty'} • {fileInfo?.type || 'Generic Asset'}
        </p>
      }
      footerActions={
        authStatus === 'authenticated' && !isReadOnly && (
          <div className="flex gap-2">
            {isSynced ? (
              <button 
                onClick={handleRemoveFromCloud}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
              >
                <CloudOff className="w-3.5 h-3.5" />
                Remove from Cloud
              </button>
            ) : (
              <button 
                onClick={handleSyncToCloud}
                disabled={isSyncing || isSyncBlocked || (!localPreviewUrl && !thought.storageUrl)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                  (isSyncing || isSyncBlocked) 
                    ? "bg-blue-500/5 border-blue-500/10 text-blue-400 opacity-50 cursor-wait" 
                    : "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20 text-blue-400"
                )}
              >
                {isSyncing || isSyncBlocked ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                {isSyncing ? 'Syncing...' : isSyncBlocked ? 'Pending Sync' : 'Sync to Cloud'}
              </button>
            )}
          </div>
        )
      }
    >
      <EditorContent 
        thought={thought}
        fileInfo={fileInfo}
        image={image}
        localPreviewUrl={localPreviewUrl}
        isUploading={isUploading}
        isFetching={isFetching}
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
