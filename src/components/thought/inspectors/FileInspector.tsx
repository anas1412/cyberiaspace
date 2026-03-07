import React from 'react';
import { useStore } from '../../../store/useStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useModalStore } from '../../../store/useModalStore';
import { db } from '../../../db';
import { type InspectorPanelProps } from '../registry';
import { MAX_FILE_SIZE_MB } from '../../../constants';
import { generateThumbnail, generateVideoThumbnail } from '../../../utils/image';
import { Upload } from 'lucide-react';

export const FileInspector: React.FC<InspectorPanelProps> = ({ thought, isReadOnly }) => {
  const updateThought = useStore(state => state.updateThought);
  const uploadThoughtBlob = useAuthStore((state) => state.uploadThoughtBlob);
  const openModal = useModalStore(state => state.openModal);

  return (
    <div className="space-y-6">
      {!isReadOnly && (
        <div className="border border-dashed border-white/10 rounded-xl p-6 text-center hover:bg-white/5 transition-colors cursor-pointer relative flex flex-col items-center justify-center gap-3">
          <input
            type="file"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                  openModal({
                    title: 'Incompatible Mass',
                    description: `This asset exceeds the ${MAX_FILE_SIZE_MB}MB transmission limit. Please compress your assets or use a smaller file.`,
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

                // 1. Put blob FIRST to avoid race condition in renderer
                await db.blobs.put({
                  id: `local-${Date.now()}-${thought.id}`,
                  thoughtId: thought.id,
                  blob: file,
                  name: file.name,
                  type: file.type,
                  updatedAt: Date.now()
                });

                // 2. Then update thought to trigger re-render
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

                uploadThoughtBlob(thought.id);
              }
            }}
          />
          <Upload className="w-5 h-5 text-slate-500" />
          <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Upload or Drag File</p>
        </div>
      )}
    </div>
  );
};
