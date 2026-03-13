import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useSyncStore } from '../../store/useSyncStore';
import { useThoughtPayload } from '../thought/hooks/useThoughtPayload';
import { useModalStore } from '../../store/useModalStore';
import { 
  File as FileIcon, Upload, Download, Loader2, FileAudio, 
  Database, CloudOff, ExternalLink, 
  ChevronDown, ChevronUp, Palette, Edit2, Check
} from 'lucide-react';
import { FocusEditorShell } from './FocusEditorShell';
import { MAX_FILE_SIZE_MB, STACK_COLORS } from '../../constants';
import { generateThumbnail, generateVideoThumbnail } from '../../utils/image';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from '../../db';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ColorPicker: React.FC<{ value: string; onChange: (val: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
        className={cn(
          "w-3 h-3 rounded-full border border-white/20 transition-all flex items-center justify-center group relative overflow-hidden",
          disabled && "opacity-50 cursor-default"
        )}
        style={{ backgroundColor: value, boxShadow: `0 0 10px ${value}88` }}
      >
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Palette className="w-1.5 h-1.5 text-white" />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-full mb-3 left-0 z-[100] glass border border-white/10 rounded-2xl p-3 shadow-2xl min-w-[180px]"
          >
            <div className="grid grid-cols-4 gap-2 mb-3">
              {STACK_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => { onChange(color); setIsOpen(false); }}
                  className={cn(
                    "w-8 h-8 rounded-lg border-2 transition-all hover:scale-110",
                    value === color ? "border-white" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="relative pt-2 border-t border-white/5">
              <input 
                type="color" 
                value={value.startsWith('#') ? value : '#6366f1'} 
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-8 bg-transparent cursor-pointer rounded-lg overflow-hidden"
              />
              <p className="text-[7px] font-black uppercase tracking-widest text-slate-500 mt-1 text-center">Custom Hex</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StackItemThumbnail: React.FC<{ 
  item: any; 
  isActive: boolean;
  onClick: (type: any) => void;
  color?: string;
}> = ({ item, isActive, onClick, color }) => {
  const thumb = item.data?.url || item.image;
  const accentColor = color || '#6366f1';
  
  // Detect file type for icon fallback
  const fileName = (item.text || '').toLowerCase();
  const mimeType = (item.data?.meta?.type || '').toLowerCase();
  const extension = fileName.split('.').pop() || '';
  const isPdf = mimeType.includes('pdf') || extension === 'pdf';
  const isAudio = mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(extension);
  const isVideo = mimeType.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v'].includes(extension);

  return (
    <button
      onClick={() => onClick(item.type)}
      data-active={isActive}
      className={cn(
        "flex-shrink-0 w-24 md:w-32 aspect-video rounded-xl overflow-hidden border transition-all duration-300 group/item snap-start relative bg-white/[0.03]",
        isActive 
          ? "scale-105 z-10" 
          : "border-white/5 hover:border-white/20 hover:scale-[1.02]"
      )}
      style={isActive ? { 
        borderColor: accentColor,
        boxShadow: `0 0 20px ${accentColor}33`,
      } : {}}
    >
      {/* 1. Thumbnail Image or Icon Fallback */}
      <div className="absolute inset-0 flex items-center justify-center">
        {thumb && !isPdf && !isAudio ? (
          <img 
            src={thumb} 
            alt={item.text} 
            className={cn(
              "w-full h-full object-cover transition-all duration-500",
              isActive ? "opacity-100" : "opacity-40 group-hover/item:opacity-80"
            )} 
          />
        ) : (
          <div className="flex flex-col items-center gap-1 opacity-40 group-hover/item:opacity-80 transition-opacity">
            {isPdf ? (
              <FileIcon className="w-6 h-6 text-red-400" />
            ) : isAudio ? (
              <FileAudio className="w-6 h-6 text-blue-400" />
            ) : isVideo ? (
              <div className="relative">
                <FileIcon className="w-6 h-6 text-purple-400" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full translate-x-0.5" />
                </div>
              </div>
            ) : (
              <FileIcon className="w-6 h-6 text-slate-400" />
            )}
          </div>
        )}
      </div>

      {/* 2. Active Indicator Border (Perfectly Aligned) */}
      {isActive && (
        <div 
          className="absolute inset-0 border-2 pointer-events-none rounded-xl"
          style={{ borderColor: accentColor }}
        />
      )}

      {/* 3. Label Overlay */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity flex items-end p-2 text-left",
        isActive ? "opacity-100" : "opacity-0 group-hover/item:opacity-100"
      )}>
        <p className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-white truncate w-full">
          {item.text || "Untitled"}
        </p>
      </div>

      {/* 4. Pulse Dot */}
      {isActive && (
        <div 
          className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full animate-pulse z-20" 
          style={{ backgroundColor: accentColor, boxShadow: `0 0 10px ${accentColor}` }}
        />
      )}
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
  setActiveFocus: (id: string | null, type: any) => void;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  stack: any;
  isReadOnly: boolean;
  isDemo: boolean;
}> = ({ 
  thought, fileInfo, image, localPreviewUrl, isUploading, isFetching,
  handleFileSelect, 
  stackItems, setActiveFocus,   scrollerRef, stack,
  isReadOnly, isDemo
}) => {
  const [showPreviews, setShowPreviews] = useState(true);
  const [isRenamingStack, setIsRenamingStack] = useState(false);
  const [tempStackName, setTempStackName] = useState(stack?.name || '');
  const isStranded = !thought.storageUrl && !localPreviewUrl && !image && !!thought.storagePath;

  useEffect(() => {
    setTempStackName(stack?.name || '');
  }, [stack?.name]);

  const handleStackRename = async () => {
    if (!stack || isReadOnly || isDemo) return;
    const finalName = tempStackName.trim();
    if (finalName && finalName !== stack.name) {
      const { useStore } = await import('../../store/useStore');
      await useStore.getState().updateStack(stack.id, { name: finalName });
    }
    setIsRenamingStack(false);
  };

  // Robust type detection using cached flags or re-analyzing
  const cached = fileInfo || {};
  const fileName = (cached.name || thought.text || '').toLowerCase();
  const mimeType = (cached.type || '').toLowerCase();
  const extension = fileName.split('.').pop() || '';
  
  const isLocalOnly = thought.syncStatus === 'local' || thought.syncStatus === 'error';
  // LOCAL FIRST GUARD: If we are still fetching/checking local, don't fallback to cloud yet
  const activeSource = isFetching 
    ? localPreviewUrl 
    : (localPreviewUrl || (isLocalOnly ? null : thought.storageUrl) || image);

  // Use cached values if available, otherwise analyze
  const isPdf = cached.isPdf ?? (mimeType.includes('pdf') || extension === 'pdf');
  const isVideo = cached.isVideo ?? (mimeType.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v'].includes(extension));
  const isAudio = cached.isAudio ?? (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(extension));
  
  // Strict Image Detection (Exclude Audio, Video, and PDF)
  const isImage = cached.isImage ?? ((mimeType.startsWith('image/') || 
                  ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) && 
                  !isAudio && !isVideo && !isPdf);

  // SAVE ANALYSIS RESULT (Triggered in parent to avoid render-loop)
  useEffect(() => {
    if (thought && !isReadOnly && !isDemo) {
      const needsUpdate = cached.isPdf === undefined || 
                          cached.isImage === undefined || 
                          cached.isVideo === undefined || 
                          cached.isAudio === undefined;

      
      if (needsUpdate && (mimeType || extension)) {
        const updateStore = async () => {
          const { useStore } = await import('../../store/useStore');
          const meta = { 
            ...(thought.meta || {}), 
            file: { 
              ...(thought.meta?.file || {}), 
              isPdf, isImage, isVideo, isAudio 
            } 
          };
          
          await useStore.getState().updateThought(thought.id, { 
            meta,
            data: thought.data?.type === 'file' ? { ...thought.data, meta } : thought.data
          }, { skipSync: true });
        };
        updateStore();
      }
    }
  }, [thought?.id, isPdf, isImage, isVideo, isAudio, cached.isPdf, isReadOnly, isDemo]);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div className="flex-1 relative min-h-0 z-0">
        {isFetching && !activeSource ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 gap-4 backdrop-blur-sm">
            <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accent)] animate-pulse">Retrieving Data...</p>
          </div>
        ) : isStranded ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020408]/40 p-8 text-center gap-6">
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
          <div className="absolute inset-0 flex items-center justify-center p-4 md:p-12">
            {isPdf ? (
              <iframe 
                src={activeSource}
                className="w-full h-full border border-white/5 bg-white rounded-2xl shadow-2xl"
                title="PDF Preview"
              />
            ) : isImage ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <div className="absolute inset-0 blur-3xl opacity-20 bg-[var(--accent)]/10 scale-75 -z-10" />
                <img 
                  src={activeSource}
                  alt={thought.text}
                  className="max-w-full max-h-full object-contain rounded-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] transition-opacity duration-700"
                  style={{ opacity: isFetching ? 0.5 : 1 }}
                />
              </div>
            ) : isVideo ? (
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl bg-black/40 shadow-2xl border border-white/5">
                <video 
                  src={activeSource}
                  poster={image || undefined}
                  controls
                  playsInline
                  loop
                  className="w-full h-full object-contain"
                />
              </div>
            ) : isAudio ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center rounded-2xl bg-black/20 shadow-2xl border border-white/5">
                <div className="flex-1 flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[var(--accent)]/10 rounded-full blur-3xl animate-pulse scale-150" />
                    <div className="relative w-32 h-32 md:w-40 md:h-40 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                      <FileAudio className="w-16 h-12 md:w-20 md:h-16 text-[var(--accent)] opacity-60" />
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
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <div className="w-24 h-24 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center mb-6">
                  <FileIcon className="w-10 h-10 text-slate-600" />
                </div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] opacity-50">Preview unavailable for this format</p>
              </div>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 p-8 text-center">
            <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] border border-white/10 flex items-center justify-center mb-8 shadow-2xl relative group transition-all hover:scale-110 hover:border-[var(--accent)]/30">
              <Upload className="w-10 h-10 text-slate-500 group-hover:text-[var(--accent)] transition-colors" />
              {isUploading && (
                <div className="absolute inset-0 bg-black/60 rounded-[2.5rem] flex items-center justify-center backdrop-blur-sm">
                  <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
                </div>
              )}
            </div>
            <h3 className="text-xl font-black uppercase tracking-[0.3em] text-white mb-3">Empty Slot</h3>
            <p className="text-[10px] font-bold text-slate-500 leading-relaxed mb-8 uppercase tracking-[0.2em] opacity-60">
              Drop a file or select one to begin
            </p>
            <label className={cn(
              "inline-flex items-center gap-3 px-10 py-5 bg-[var(--accent)] hover:brightness-110 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all cursor-pointer shadow-xl shadow-[var(--accent)]/10 active:scale-95",
              isUploading && "opacity-50 pointer-events-none"
            )}>
              <Upload className="w-4 h-4" />
              Initialize Asset
              <input type="file" className="hidden" onChange={handleFileSelect} disabled={isUploading} />
            </label>
          </div>
        )}
      </div>

      <AnimatePresence>
        {stackItems.length > 0 && (
          <div className={cn("relative z-10 mx-6", showPreviews ? "mb-6" : "mb-3")}>
            <div className={cn(
              "bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl transition-all duration-300",
              showPreviews ? "p-4 md:p-5" : "p-2 px-4"
            )}>
              <div 
                className="flex items-center justify-between px-1 cursor-pointer select-none group/stackheader"
                onClick={() => setShowPreviews(!showPreviews)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center">
                    <ColorPicker 
                      value={stack?.color || '#6366f1'} 
                      disabled={isReadOnly}
                      onChange={(color) => useStore.getState().updateStack(stack.id, { color })} 
                    />
                  </div>
                  <div className="flex items-center gap-2 group/stackname">
                    {isRenamingStack ? (
                      <div className="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1 border border-white/10">
                        <input
                          autoFocus
                          className="bg-transparent text-[9px] font-black uppercase tracking-[0.3em] text-white border-none outline-none w-24"
                          value={tempStackName}
                          onChange={(e) => setTempStackName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleStackRename();
                            if (e.key === 'Escape') {
                              setIsRenamingStack(false);
                              setTempStackName(stack?.name || '');
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleStackRename(); }}
                          className="p-0.5 hover:bg-white/10 rounded transition-colors"
                        >
                          <Check className="w-2 h-2 text-emerald-400" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span 
                          className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 group-hover/stackheader:text-slate-200 transition-colors pt-[1px]"
                          onDoubleClick={() => { if (!isReadOnly && !isDemo) setIsRenamingStack(true); }}
                        >
                          {stack?.name || 'Collection'}
                        </span>
                        {!isReadOnly && !isDemo && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setIsRenamingStack(true); }}
                            className="p-1 opacity-0 group-hover/stackname:opacity-100 hover:bg-white/10 rounded transition-all"
                          >
                            <Edit2 className="w-2 h-2 text-slate-500 hover:text-white" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em] group-hover/stackheader:text-slate-300 transition-colors">
                    {stackItems.findIndex(i => i.id === thought.id) + 1} / {stackItems.length}
                  </span>
                  <div 
                    className="p-1 hover:bg-white/5 rounded-md text-slate-500 group-hover/stackheader:text-white transition-all"
                    title={showPreviews ? "Hide Previews" : "Show Previews"}
                  >
                    {showPreviews ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </div>
                </div>
              </div>
              {showPreviews && (
                <div className="flex gap-4 overflow-x-auto custom-scroll pb-1 w-full snap-x mt-4" ref={scrollerRef}>
                  {stackItems.map((item) => (
                    <StackItemThumbnail 
                      key={item.id} 
                      item={item} 
                      isActive={item.id === thought.id}
                      color={stack?.color}
                      onClick={(type) => setActiveFocus(item.id, type)} 
                    />
                  ))}
                </div>
              )}
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
  const isDemo = useStore((state) => state.isDemo);
  const { 
    uploadThoughtBlob, 
    removeCloudAsset
  } = useAuthStore();
  const openModal = useModalStore(state => state.openModal);

  const thought = thoughts.find((t) => t.id === activeFocusId);
  const { image, fileInfo } = useThoughtPayload(thought);
  const stack = stacks.find((s) => s.id === thought?.stackId);
  const isVisible = focusType === 'file' && !!thought;

  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isFetching, setIsFetching] = useState(true); // Start true to guard initial check
  const scrollerRef = useRef<HTMLDivElement>(null);

  // RESET LOGIC: When thought ID changes, clear state and revoke URLs
  useEffect(() => {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    setLocalPreviewUrl(null);
    setIsFetching(true); // Always reset to true when thought changes
    setIsUploading(false);

    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [thought?.id]);

  const stackItems = useMemo(() => {
    if (!thought?.stackId) return [];
    const sid = thought.stackId;
    return thoughts
      .filter(t => t.stackId === sid && (t.type === 'file' || t.type === 'embed'))
      .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
  }, [thoughts, thought?.stackId]);


  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { if (e.deltaY === 0) return; e.preventDefault(); el.scrollLeft += e.deltaY; };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isVisible, stackItems.length]);

  useEffect(() => {
    // Scroll the active item into view
    if (scrollerRef.current) {
      const activeEl = scrollerRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [thought?.id, stackItems.length]);

  useEffect(() => {
    // Only load if visible, has thought, and NO local URL already set
    if (isVisible && thought && !localPreviewUrl) {
      loadLocalBlob();
    }
  }, [isVisible, thought?.id, thought?.updatedAt, localPreviewUrl]);

  const loadLocalBlob = async () => {
    if (!thought) return;
    setIsFetching(true);
    try {
      const blobEntry = await db.blobs.where('thoughtId').equals(thought.id).first();
      if (blobEntry) {
        const url = URL.createObjectURL(blobEntry.blob);
        setLocalPreviewUrl(url);
        // Trigger a store update to notify UI that local blob is now available
        try {
          const { useStore } = await import('../../store/useStore');
          useStore.getState().updateThought(thought.id, { updatedAt: Date.now() }, { skipSync: true });
        } catch {}
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
        id: thought.id, // Deterministic ID
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
    await uploadThoughtBlob(thought.id, true);
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

  const isSynced = !!thought.storageUrl;
  const isSyncing = thought.syncStatus === 'syncing';
  
  // Guard the source label to avoid flashing "Cloud" while checking local
  const sourceLabel = isFetching 
    ? 'Checking...' 
    : (localPreviewUrl ? 'Local' : (thought.storageUrl ? 'Cloud' : 'None'));

  const CloudPill = () => {
    const [isHovered, setIsHovered] = useState(false);
    
    if (isSyncing || isSyncBlocked) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/5 border border-blue-500/10 rounded-xl opacity-50 cursor-wait">
          <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
          <span className="text-[7px] font-black uppercase tracking-[0.2em] text-blue-400">
            {isSyncing ? 'Synchronizing' : 'Sync Blocked'}
          </span>
        </div>
      );
    }

    if (isSynced) {
      return (
        <button 
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleRemoveFromCloud}
          disabled={isReadOnly}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300 border select-none group/pill",
            isHovered 
              ? "bg-red-500/10 border-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]" 
              : "bg-emerald-500/5 border-emerald-500/10 text-emerald-400"
          )}
        >
          <div className={cn(
            "w-1.5 h-1.5 rounded-full shadow-sm transition-colors duration-300",
            isHovered ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"
          )} />
          <span className="text-[7px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
            {isHovered ? 'Remove from Cloud' : 'Cloud Synced'}
          </span>
        </button>
      );
    }

    return (
      <button 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleSyncToCloud}
        disabled={isReadOnly || (!localPreviewUrl && !thought?.storageUrl)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300 border select-none group/pill",
          isHovered 
            ? "bg-blue-500/10 border-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]" 
            : "bg-slate-500/5 border-white/5 text-slate-500"
        )}
      >
        <div className={cn(
          "w-1.5 h-1.5 rounded-full shadow-sm transition-colors duration-300",
          isHovered ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" : "bg-slate-600"
        )} />
        <span className="text-[7px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
          {isHovered ? 'Propagate to Cloud' : 'Local Only'}
        </span>
      </button>
    );
  };

  return (
    <FocusEditorShell
      isVisible={isVisible}
      onClose={() => setActiveFocus(null, null)}
      title={thought.text}
      onTitleChange={(val) => { if (!isReadOnly) updateThought(thought.id, { text: val }); }}
      description={thought.description}
      isReadOnly={isReadOnly}
      headerActions={
        <div className="flex items-center gap-3">
          <CloudPill />
        </div>
      }
      footerStatus={
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Origin</span>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{sourceLabel}</span>
          </div>
          <div className="w-px h-6 bg-white/5" />
          <div className="flex flex-col">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Format</span>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest truncate max-w-[100px]">
              {isFetching ? '...' : (fileInfo?.type?.split('/')[1]?.toUpperCase() || 'GENERIC')}
            </span>
          </div>
          <div className="w-px h-6 bg-white/5" />
          <div className="flex flex-col">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Payload</span>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
              {isFetching ? '...' : (fileInfo?.size ? `${(fileInfo.size / (1024 * 1024)).toFixed(2)}MB` : '0.00MB')}
            </span>
          </div>
        </div>
      }
      footerActions={
        <div className="flex items-center gap-2">
          {(localPreviewUrl || thought.storageUrl) && (
            <button 
              onClick={handleDownload} 
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all border border-white/5 group active:scale-95" 
              title="Download Locally"
            >
              <Download className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </button>
          )}
          <a 
            href={thought.storageUrl || localPreviewUrl || undefined} 
            target="_blank" 
            rel="noreferrer" 
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all border border-white/5 group active:scale-95" 
            title="Open in New Tab"
          >
            <ExternalLink className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          </a>
        </div>
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
        isReadOnly={isReadOnly}
        isDemo={isDemo}
      />
    </FocusEditorShell>
  );
};

export default FileFocusEditor;
