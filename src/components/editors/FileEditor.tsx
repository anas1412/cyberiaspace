import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { useThoughtPayload } from '../thought/hooks/useThoughtPayload';
import {
  File as FileIcon, Download, Loader2, FileAudio,
  ExternalLink,
  ChevronLeft, ChevronRight, X, Upload
} from 'lucide-react';
import { db, type Thought } from '../../db';
import { getEmbedInfo } from '../../utils/embeds';
import { StackFilmstrip } from './StackFilmstrip';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { detectImageType, generateThumbnail } from '../../utils/image';
import { stripFileExtension } from '../../utils/file';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ──────────────────────────────────────────────
// FileEditor
// ──────────────────────────────────────────────

interface FileEditorProps {
  thought: Thought;
  onClose: () => void;
}

const FileEditor: React.FC<FileEditorProps> = ({ thought, onClose }) => {
  // Store reads — mutations only
  const updateThought = useStore((state) => state.updateThought);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const thoughts = useStore((state) => state.thoughts);
  const isReadOnly = useStore((state) => state.isReadOnly);
  const isDemo = useStore((state) => state.isDemo);

  // Payload
  const { fileInfo } = useThoughtPayload(thought);

  // ── State ──
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [localTitle, setLocalTitle] = useState(thought.text);

  // ── Derived ──
  const stackItems = useMemo(() => {
    if (!thought?.stackId) return [];
    const sid = thought.stackId;
    return thoughts
      .filter(t => {
        if (t.stackId !== sid) return false;
        if (t.type === 'file') return true;
        if (t.type === 'embed') {
          const url = (t.data as any)?.url || (t as any).content || '';
          const info = getEmbedInfo(url);
          return info.provider === 'youtube';
        }
        return false;
      })
      .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
  }, [thoughts, thought?.stackId]);

  const currentIndex = stackItems.findIndex(i => i.id === thought.id);

  // Type detection
  const fileName = (fileInfo?.name || thought.text || '').toLowerCase();
  const mimeType = (fileInfo?.type || '').toLowerCase();
  const extension = fileName.split('.').pop() || '';
  const fileUrl = thought?.data?.type === 'file' ? thought.data.url : undefined;
  const activeSource = isFetching ? localPreviewUrl : (localPreviewUrl || fileUrl);
  const isPdf = fileInfo?.isPdf ?? false;
  const isVideo = fileInfo?.isVideo ?? false;
  const isAudio = fileInfo?.isAudio ?? false;
  const isImage = fileInfo?.isImage ?? false;

  // Sync title with prop
  useEffect(() => {
    setLocalTitle(thought.text);
  }, [thought.id, thought.text]);

  // Reset state when thought changes
  useEffect(() => {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    setLocalPreviewUrl(null);
    setIsFetching(true);

    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thought?.id]);

  // Load blob from IndexedDB
  useEffect(() => {
    if (thought && !localPreviewUrl) {
      loadLocalBlob();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thought?.id, thought?.updatedAt, localPreviewUrl]);

  // Save type analysis results
  useEffect(() => {
    if (thought && !isReadOnly && !isDemo) {
      const needsUpdate = (fileInfo as any)?.raw?.isPdf === undefined ||
                          (fileInfo as any)?.raw?.isImage === undefined ||
                          (fileInfo as any)?.raw?.isVideo === undefined ||
                          (fileInfo as any)?.raw?.isAudio === undefined;

      if (needsUpdate && (mimeType || extension)) {
        const meta = {
          ...(thought.meta || {}),
          file: {
            ...(thought.meta?.file || {}),
            isPdf, isImage, isVideo, isAudio
          }
        };

        updateThought(thought.id, {
          meta,
          data: thought.data?.type === 'file' ? { ...thought.data, meta } : thought.data
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thought?.id, isPdf, isImage, isVideo, isAudio, isReadOnly, isDemo]);

  // ── Handlers ──

  const loadLocalBlob = async () => {
    if (!thought) return;
    setIsFetching(true);
    try {
      const blobEntry = await db.blobs.where('thoughtId').equals(thought.id).first();
      if (blobEntry) {
        const url = URL.createObjectURL(blobEntry.blob);
        setLocalPreviewUrl(url);
        try {
          updateThought(thought.id, { updatedAt: Date.now() });
        } catch {}
      }
    } catch (e) {
      console.warn("[FileEditor] Local blob load failed", e);
    } finally {
      setIsFetching(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !thought) return;

    setIsUploading(true);
    try {
      const actualType = await detectImageType(file);
      const thumbnail = await generateThumbnail(file).catch(() => null);
      
      const fileName = file.name;
      const fileSize = file.size;

      const meta = {
        file: {
          name: fileName,
          size: fileSize,
          type: actualType,
          isImage: actualType.startsWith('image/'),
          isPdf: actualType === 'application/pdf',
          isVideo: actualType.startsWith('video/'),
          isAudio: actualType.startsWith('audio/')
        }
      };

      await updateThought(thought.id, {
        text: stripFileExtension(fileName),
        data: {
          type: 'file',
          url: thumbnail || '',
          name: fileName,
          size: fileSize,
          meta: meta.file
        },
        meta: meta,
        updatedAt: Date.now()
      });

      await db.blobs.put({
        id: thought.id,
        thoughtId: thought.id,
        blob: file,
        name: fileName,
        type: actualType,
        updatedAt: Date.now()
      });

      // Reload
      await loadLocalBlob();
    } catch (err) {
      console.error("[FileEditor] Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = () => {
    if (!thought) return;
    if (localPreviewUrl) {
      const a = document.createElement('a');
      a.href = localPreviewUrl;
      a.download = thought.text || 'asset';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleOpenExternal = () => {
    if (!thought) return;
    if (localPreviewUrl) {
      window.open(localPreviewUrl, '_blank');
    }
  };

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (stackItems.length <= 1) return;
    const prevIndex = (currentIndex - 1 + stackItems.length) % stackItems.length;
    const prevItem = stackItems[prevIndex];
    setActiveFocus(prevItem.id, prevItem.type as any);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (stackItems.length <= 1) return;
    const nextIndex = (currentIndex + 1) % stackItems.length;
    const nextItem = stackItems[nextIndex];
    setActiveFocus(nextItem.id, nextItem.type as any);
  };

  const handleTitleChange = (val: string) => {
    setLocalTitle(val);
    if (!isReadOnly) {
      updateThought(thought.id, { text: val });
    }
  };

  // ── Render ──

  return (
    <div className="flex flex-col h-full relative">
      {/* ── Header: Inline Title + Actions + Close ── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--glass-border)] min-h-[44px]">
        <input
          type="text"
          value={localTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled File"
          readOnly={isReadOnly}
          className="flex-1 bg-transparent border-none outline-none text-[13px] font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/30"
        />
        {activeSource && (isImage || isVideo || isAudio) && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-all"
              title="Download"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleOpenExternal}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-all"
              title="Open in New Tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-all"
          title="Close (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <div className="flex-1 relative min-h-0 z-0 shadow-inner group/content">
          {/* Loading state */}
          {isFetching && !activeSource && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--glass-bg)] gap-4 backdrop-blur-sm">
              <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
              <p className="text-[10px] font-semibold tracking-[0.3em] text-[var(--accent)] animate-pulse">Retrieving Data...</p>
            </div>
          )}

          {/* Media preview */}
          {activeSource ? (
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
                    className="max-w-[90%] max-h-[85%] object-contain rounded-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] transition-opacity duration-700"
                    style={{ opacity: isFetching ? 0.5 : 1 }}
                  />
                </div>
              ) : isVideo ? (
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl bg-[var(--glass-bg)] shadow-2xl border border-[var(--glass-border)]">
                  <video
                    src={activeSource}
                    poster={thought?.data?.type === 'file' ? thought.data.url : undefined}
                    controls
                    playsInline
                    loop
                    className="max-w-[90%] max-h-[85%] object-contain"
                  />
                </div>
              ) : isAudio ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center rounded-2xl bg-[var(--glass-bg)] shadow-2xl border border-[var(--glass-border)]">
                  <div className="flex-1 flex items-center justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-[var(--accent)]/10 rounded-full blur-3xl animate-pulse scale-150" />
                      <div className="relative w-32 h-32 md:w-40 md:h-40 bg-[var(--glass-bg)] rounded-full flex items-center justify-center border border-[var(--glass-border)]">
                        <FileAudio className="w-16 h-12 md:w-20 md:h-16 text-[var(--accent)] opacity-60" />
                      </div>
                    </div>
                  </div>
                  <div className="w-full p-6 md:p-10 bg-[var(--glass-bg)] backdrop-blur-xl border-t border-[var(--glass-border)]">
                    <audio
                      controls
                      autoPlay
                      className="w-full h-10"
                      src={activeSource}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-24 h-24 bg-white/5 rounded-3xl border border-[var(--glass-border)] flex items-center justify-center mb-6">
                    <FileIcon className="w-10 h-10 text-[var(--text-muted)]" />
                  </div>
                  <p className="text-[var(--text-muted)] text-[10px] font-semibold tracking-[0.3em] opacity-50">
                    Preview unavailable for this format
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* ── Empty / Upload State ── */
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--glass-bg)] p-8 text-center">
              <div className="w-24 h-24 bg-[var(--glass-bg)] rounded-[2.5rem] border border-[var(--glass-border)] flex items-center justify-center mb-8 shadow-2xl relative group transition-all hover:scale-110 hover:border-[var(--accent)]/30">
                <Upload className="w-10 h-10 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                {isUploading && (
                  <div className="absolute inset-0 bg-[var(--glass-bg)] rounded-[2.5rem] flex items-center justify-center backdrop-blur-sm">
                    <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
                  </div>
                )}
              </div>
              <h3 className="text-xl font-semibold tracking-[0.3em] text-[var(--text-primary)] mb-3">Empty Slot</h3>
              <p className="text-[10px] font-bold text-[var(--text-muted)] leading-relaxed mb-8 uppercase tracking-[0.2em] opacity-60">
                Drop a file or select one to begin
              </p>
              <label className={cn(
                "inline-flex items-center gap-3 px-10 py-5 bg-[var(--accent)] hover:brightness-110 text-[var(--accent-contrast)] rounded-2xl text-[10px] font-semibold tracking-[0.3em] transition-all cursor-pointer shadow-xl shadow-[var(--accent)]/10 active:scale-95",
                isUploading && "opacity-50 pointer-events-none"
              )}>
                <Upload className="w-4 h-4" />
                Initialize Asset
                <input type="file" className="hidden" onChange={handleFileSelect} disabled={isUploading} />
              </label>
            </div>
          )}

          {/* ── Navigation Buttons ── */}
          {stackItems.length > 1 && (
            <>
              <div className="absolute inset-y-0 left-0 flex items-center px-4 md:px-8 pointer-events-none z-10">
                <button
                  onClick={handlePrevious}
                  className="w-12 h-12 rounded-full glass flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:scale-110 transition-all pointer-events-auto opacity-0 group-hover/content:opacity-100 shadow-2xl translate-x-[-20px] group-hover/content:translate-x-0"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 md:px-8 pointer-events-none z-10">
                <button
                  onClick={handleNext}
                  className="w-12 h-12 rounded-full glass flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:scale-110 transition-all pointer-events-auto opacity-0 group-hover/content:opacity-100 shadow-2xl translate-x-[20px] group-hover/content:translate-x-0"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Shared StackFilmstrip — consistent across all editor types */}
        <StackFilmstrip thought={thought} stackItems={stackItems} currentIndex={currentIndex} />
      </div>
    </div>
  );
};

export { FileEditor };
export const FileEditorContent = FileEditor;
export default FileEditor;
