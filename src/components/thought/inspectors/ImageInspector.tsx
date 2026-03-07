import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useModalStore } from '../../../store/useModalStore';
import { db } from '../../../db';
import { type InspectorPanelProps } from '../registry';
import { MAX_FILE_SIZE_MB } from '../../../constants';
import { generateThumbnail } from '../../../utils/image';
import { useThoughtPayload } from '../hooks/useThoughtPayload';

export const ImageInspector: React.FC<InspectorPanelProps> = ({ thought, isReadOnly }) => {
  const setActiveFocus = useStore(state => state.setActiveFocus);
  const updateThought = useStore(state => state.updateThought);
  const uploadThoughtBlob = useAuthStore((state) => state.uploadThoughtBlob);
  const openModal = useModalStore(state => state.openModal);
  const { image } = useThoughtPayload(thought);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setActiveFocus(thought.id, 'file')}
        className="w-full bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-[var(--accent-secondary)] py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex flex-col items-center gap-3"
      >
        <ImageIcon className="w-5 h-5" />
        Open Image Manager
      </button>

      {!isReadOnly && (
        <div className="border border-dashed border-white/10 rounded-xl p-4 text-center hover:bg-white/5 transition-colors cursor-pointer relative">
          <input
            type="file"
            accept="image/*"
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
                
                const thumbnail = await generateThumbnail(file).catch(() => null);
                const meta = { ...thought.meta, file: { name: file.name, size: file.size, type: file.type } };
                
                await updateThought(thought.id, { 
                  text: file.name,
                  meta,
                  data: { 
                    type: 'image', 
                    url: thumbnail || '', 
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
                uploadThoughtBlob(thought.id);
              }
            }}
          />
          <ImageIcon className="w-6 h-6 mx-auto text-slate-500 mb-2" />
          <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Update Image Asset</p>
        </div>
      )}
      {image && (
        <div className="rounded-xl border border-white/10 overflow-hidden bg-black/50">
          <img src={image} className="w-full object-contain" alt="Preview" />
        </div>
      )}
    </div>
  );
};
