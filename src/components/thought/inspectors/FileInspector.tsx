import React from 'react';
import { useStore } from '../../../store/useStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useModalStore } from '../../../store/useModalStore';
import { db } from '../../../db';
import { type InspectorPanelProps } from '../registry';
import { MAX_UPLOAD_SIZE, MAX_UPLOAD_SIZE_MB } from '../../../constants';
import { generateThumbnail, generateVideoThumbnail } from '../../../utils/image';
import { Upload, FileText } from 'lucide-react';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const FileInspector: React.FC<InspectorPanelProps> = ({ thought, isReadOnly }) => {
  const updateThought = useStore(state => state.updateThought);
  const uploadThoughtBlob = useAuthStore((state) => state.uploadThoughtBlob);
  const openModal = useModalStore(state => state.openModal);

  const fileData = thought.data as { type: string; name?: string; size?: number; meta?: { file?: { type?: string } } } | undefined;
  const hasFile = fileData?.name;

  return (
    <div className="space-y-6">
      {hasFile ? (
        <div className="flex items-center gap-3 p-4 bg-[var(--bg-page)]/20 border border-[var(--glass-border)] rounded-xl">
          <FileText className="w-5 h-5 text-[var(--accent-secondary)] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[var(--text-primary)] truncate">{fileData.name}</p>
            <p className="text-[9px] text-[var(--text-muted)]">
              {formatFileSize(fileData.size || 0)} • {(fileData.meta?.file?.type || 'application/octet-stream').split('/')[1]}
            </p>
          </div>
        </div>
      ) : !isReadOnly && (
        <div className="border border-dashed border-white/10 rounded-xl p-6 text-center hover:bg-white/5 transition-colors cursor-pointer relative flex flex-col items-center justify-center gap-3">
          <input
            type="file"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > MAX_UPLOAD_SIZE) {
                  openModal({
                    title: 'Incompatible Mass',
                    description: `This asset exceeds the ${MAX_UPLOAD_SIZE_MB}MB transmission limit. Please compress your assets or use a smaller file.`,
                    type: 'alert',
                    confirmText: 'Acknowledged'
                  });
                  return;
                }
                
                const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
                const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
                
                const thumbnail = isImage 
                  ? await generateThumbnail(file).catch(() => null)
                  : isVideo 
                    ? await generateVideoThumbnail(file).catch(() => null)
                    : null;

                const meta = { ...thought.meta, file: { name: file.name, size: file.size, type: file.type } };

                // Three-Layer Architecture: Zustand FIRST, then IndexedDB, then cloud
                await updateThought(thought.id, {
                  text: file.name,
                  type: 'file',
                  meta,
                  data: {
                    type: 'file',
                    url: thumbnail || '',
                    name: file.name,
                    size: file.size,
                    meta: meta as any
                  }
                });

                await db.blobs.put({
                  id: thought.id,
                  thoughtId: thought.id,
                  blob: file,
                  name: file.name,
                  type: file.type,
                  updatedAt: Date.now(),
                  userId: useAuthStore.getState().user?.id ?? 'guest'
                });

                uploadThoughtBlob(thought.id);
              }
            }}
          />
          <Upload className="w-5 h-5 text-[var(--text-muted)]" />
          <p className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-widest">Upload or Drag File</p>
        </div>
      )}
    </div>
  );
};
