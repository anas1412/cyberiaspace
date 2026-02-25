import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { useModalStore } from '../store/useModalStore';
import { MAX_FILE_SIZE_MB } from '../constants';
import { clsx, type ClassValue } from 'clsx';

import { twMerge } from 'tailwind-merge';
import World from './World';
import { usePhysics } from '../hooks/usePhysics';
import { useViewportGestures } from '../hooks/useViewportGestures';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload } from 'lucide-react';

import { db } from '../db';
import { generateThumbnail } from '../utils/image';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Viewport: React.FC = () => {
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);
  const thoughts = useStore((state) => state.thoughts);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  const selectedThoughtId = useStore((state) => state.selectedThoughtId);
  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);
  const selectedThoughtIds = useStore((state) => state.selectedThoughtIds);
  const setSelectedThoughtIds = useStore((state) => state.setSelectedThoughtIds);
  const clearSelection = useStore((state) => state.clearSelection);
  const deleteSelectedThoughts = useStore((state) => state.deleteSelectedThoughts);
  const deleteThought = useStore((state) => state.deleteThought);
  const addThought = useStore((state) => state.addThought);
  const uploadThoughtBlob = useAuthStore((state) => state.uploadThoughtBlob);
  const saveSpaceTransform = useStore((state) => state.saveSpaceTransform);

  const transform = useStore((state) => state.transform);
  const setTransform = useStore((state) => state.setTransform);
  const isSpaceLoading = useStore((state) => state.isSpaceLoading);
  const isReadOnly = useStore((state) => state.isReadOnly);
  const isDemo = useStore((state) => state.isDemo);

  const { openModal } = useModalStore();

  const [isGrabbing, setIsGrabbing] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

  const mouseWorldPos = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  const { registerElement, registerWorld, registerGrid, handleMouseDown, handleTouchStart, isDragging, kanbanHeight } = usePhysics(canvasRef, transform);

  const getGlobalScale = useCallback(() => {
    const body = document.querySelector('.app-body') || document.body;
    const style = window.getComputedStyle(body);
    const m = new DOMMatrix(style.transform);
    return m.a || 1;
  }, []);

  const {
    handleWheel,
    handleTouchStart: handleTouchStartLocal,
    handleTouchMove,
    handleTouchEnd,
    applyConstraints,
    isPanningRef,
    isSelectingRef,
    selectionStartRef,
    lastMousePos
  } = useViewportGestures({
    activeSpaceMode: activeSpace?.mode,
    transform,
    setTransform,
    kanbanHeight: kanbanHeight.current,
    getGlobalScale,
    isDemo
  });


  useEffect(() => {
    if (activeSpace?.mode === 'spatial' && activeSpaceId) {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(() => {
        saveSpaceTransform(activeSpaceId, transform);
      }, 1000);
    }
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
        if (activeSpace?.mode === 'spatial' && activeSpaceId) {
          saveSpaceTransform(activeSpaceId, transform);
        }
      }
    };
  }, [transform, activeSpaceId, activeSpace?.mode, saveSpaceTransform]);

  useEffect(() => {
    const handleMouseDownLocal = (e: MouseEvent) => {
      const isMiddleClick = e.button === 1;
      const isAltLeftClick = e.button === 0 && e.altKey;
      const isLeftClick = e.button === 0 && !e.altKey;
      const isCtrlLeftClick = isLeftClick && (e.ctrlKey || e.metaKey);

      if (isLeftClick) {
        selectionStartRef.current = { rawX: e.clientX, rawY: e.clientY };
      }

      if (
        activeSpace?.mode === 'spatial' &&
        !(e.target as HTMLElement).closest('button, input, textarea, .thought-bulb, #inspector, .ui-layer, .expand-img, #chat-overlay, .focus-box')
      ) {
        if ((isLeftClick && !isCtrlLeftClick) || isMiddleClick || isAltLeftClick) {
          isPanningRef.current = true;
          setIsGrabbing(true);
          lastMousePos.current = { rawX: e.clientX, rawY: e.clientY };
          if (isMiddleClick || isAltLeftClick) e.preventDefault();
        } 
        else if (isCtrlLeftClick) {
          isSelectingRef.current = true;
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const s = getGlobalScale();
      const lx = e.clientX / s;
      const ly = e.clientY / s;

      mouseWorldPos.current = {
        x: (lx - transform.x) / transform.scale,
        y: (ly - transform.y) / transform.scale
      };

      if (isPanningRef.current) {
        const dx = (e.clientX - lastMousePos.current.rawX) / s;
        const dy = (e.clientY - lastMousePos.current.rawY) / s;

        setTransform(applyConstraints({
          ...transform,
          x: transform.x + dx,
          y: transform.y + dy,
        }));
      } else if (isSelectingRef.current) {
        const startLX = selectionStartRef.current.rawX / s;
        const startLY = selectionStartRef.current.rawY / s;
        const x = Math.min(lx, startLX);
        const y = Math.min(ly, startLY);
        const w = Math.abs(lx - startLX);
        const h = Math.abs(ly - startLY);

        if (w > 5 || h > 5) {
          setSelectionRect({ x, y, w, h });

          const rectX = (x - transform.x) / transform.scale;
          const rectY = (y - transform.y) / transform.scale;
          const rectW = w / transform.scale;
          const rectH = h / transform.scale;

          const selectedIds = thoughts.filter(t => {
            const tx = t.x;
            const ty = t.y;
            const tw = 280 / 2;
            const th = 200 / 2;
            return tx + tw > rectX && tx - tw < rectX + rectW &&
              ty + th > rectY && ty - th < rectY + rectH;
          }).map(t => t.id);

          setSelectedThoughtIds(selectedIds);
        }
      }
      lastMousePos.current = { rawX: e.clientX, rawY: e.clientY };
    };

    const handleMouseUp = () => {
      isPanningRef.current = false;
      isSelectingRef.current = false;
      setIsGrabbing(false);
      setSelectionRect(null);
    };

    const handleAuxClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const dist = Math.sqrt(Math.pow(e.clientX - selectionStartRef.current.rawX, 2) + Math.pow(e.clientY - selectionStartRef.current.rawY, 2));
      if (dist > 5) return;

      if (!target.closest('.thought-bulb, #inspector, .expand-img, button, input, textarea, #chat-overlay, .modal-content, .focus-box')) {
        setInspectorOpen(false);
        clearSelection();
        setSelectedThoughtId(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isReadOnly) return;
        if (selectedThoughtIds.length > 0) {
          e.preventDefault();
          openModal({
            title: `Delete ${selectedThoughtIds.length} Thoughts?`,
            description: 'This action cannot be undone.',
            type: 'delete_thought',
            confirmText: 'Delete All',
            onConfirm: () => deleteSelectedThoughts()
          });
        } else if (selectedThoughtId) {
          e.preventDefault();
          openModal({
            title: 'Delete Thought?',
            description: 'This action cannot be undone.',
            type: 'delete_thought',
            confirmText: 'Delete',
            onConfirm: () => deleteThought(selectedThoughtId)
          });
        }
      }

      if (e.key === ' ') {
        if (isReadOnly) return;
        e.preventDefault();
        if (e.repeat) return;

        if (thoughts.length >= 40) {
          openModal({
            title: 'Limit Reached',
            description: 'You have reached the maximum of 40 thoughts per space.',
            type: 'limit_thought',
            confirmText: 'Okay'
          });
          return;
        }

        const newThoughtProps: any = {
          x: mouseWorldPos.current.x,
          y: mouseWorldPos.current.y
        };

        if (activeSpace?.mode === 'kanban') {
          const s = getGlobalScale();
          const lx = lastMousePos.current.rawX / s;
          const width = window.innerWidth / s;
          if (lx < width * 0.25) newThoughtProps.status = 'none';
          else if (lx < width * 0.50) newThoughtProps.status = 'todo';
          else if (lx < width * 0.75) newThoughtProps.status = 'doing';
          else newThoughtProps.status = 'done';
        } else if (activeSpace?.mode === 'calendar') {
          const elements = document.elementsFromPoint(lastMousePos.current.rawX, lastMousePos.current.rawY);
          const cell = elements.find(el => (el as HTMLElement).classList.contains('cal-cell'));
          if (cell) {
            newThoughtProps.date = (cell as HTMLElement).dataset.date;
          }
        }

        addThought(newThoughtProps).then(id => {
          if (id !== -1) {
            setSelectedThoughtId(id);
            setInspectorOpen(true);
          }
        });
      }
    };

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDraggingFile(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDraggingFile(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.relatedTarget as HTMLElement;
      if (!target || !target.closest('#viewport')) {
        setIsDraggingFile(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      if (isReadOnly) {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFile(false);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingFile(false);

      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length === 0) return;

      const dropX = e.clientX !== 0 ? (e.clientX - transform.x) / transform.scale : window.innerWidth / 2;
      const dropY = e.clientY !== 0 ? (e.clientY - transform.y) / transform.scale : window.innerHeight / 2;

      for (const file of files) {
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          openModal({
            title: 'File Too Large',
            description: `The file "${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB transmission limit. Please compress your asset or use a smaller file.`,
            type: 'alert',
            confirmText: 'Acknowledged'
          });
          continue;
        }

        const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
        const isText = file.name.endsWith('.txt') || file.type === 'text/plain';
        const isCSV = file.name.endsWith('.csv') || file.type === 'text/csv';
        const isLarge = file.size > 2 * 1024 * 1024;

        if (isImage) {
          const thumbnail = await generateThumbnail(file).catch(err => {
            console.warn('Thumbnail generation failed:', err);
            return null;
          });

          const id = await addThought({
            type: 'image',
            text: file.name,
            image: thumbnail,
            syncStatus: 'local',
            x: dropX + (Math.random() * 20 - 10),
            y: dropY + (Math.random() * 20 - 10),
            meta: {
              file: {
                name: file.name,
                size: file.size,
                type: file.type,
              }
            }
          });

          if (id !== -1) {
            await db.blobs.add({
              id: `temp-${Date.now()}-${id}`,
              thoughtId: id,
              blob: file,
              name: file.name,
              type: file.type,
              updatedAt: Date.now()
            });
            setSelectedThoughtId(id);
            uploadThoughtBlob(id);
          }
          continue;
        }

        if (isLarge || (!isImage && !isText && !isCSV)) {
          const id = await addThought({
            type: 'file',
            text: file.name,
            syncStatus: 'local',
            x: dropX + (Math.random() * 20 - 10),
            y: dropY + (Math.random() * 20 - 10),
            meta: {
              file: {
                name: file.name,
                size: file.size,
                type: file.type,
              }
            }
          });

          if (id !== -1) {
            await db.blobs.add({
              id: `temp-${Date.now()}-${id}`,
              thoughtId: id,
              blob: file,
              name: file.name,
              type: file.type,
              updatedAt: Date.now()
            });
            setSelectedThoughtId(id);
            setInspectorOpen(true);
            uploadThoughtBlob(id);
          }
          continue;
        }

        const reader = new FileReader();
        if (file.name.endsWith('.txt') || file.type === 'text/plain') {
          reader.onload = async (ev) => {
            await addThought({
              type: 'text',
              content: ev.target?.result as string,
              x: dropX + (Math.random() * 20 - 10),
              y: dropY + (Math.random() * 20 - 10),
              text: file.name.replace('.txt', '')
            });
          };
          reader.readAsText(file);
        }
        else if (file.name.endsWith('.csv') || file.type === 'text/csv') {
          reader.onload = async (ev) => {
            const csvText = ev.target?.result as string;
            const rows = csvText.split(/\r?\n/).filter(line => line.trim()).map(line => {
              const cells: string[] = [];
              let current = '';
              let inQuotes = false;
              for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                  cells.push(current.trim());
                  current = '';
                } else {
                  current += char;
                }
              }
              cells.push(current.trim());
              return cells;
            });

            if (rows.length > 0) {
              await addThought({
                type: 'table',
                table: rows,
                x: dropX + (Math.random() * 20 - 10),
                y: dropY + (Math.random() * 20 - 10),
                text: file.name.replace('.csv', '')
              });
            }
          };
          reader.readAsText(file);
        }
      }
    };

    window.addEventListener('mousedown', handleMouseDownLocal);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('auxclick', handleAuxClick);
    window.addEventListener('click', handleClick);
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('touchstart', handleTouchStartLocal, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousedown', handleMouseDownLocal);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('auxclick', handleAuxClick);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('touchstart', handleTouchStartLocal);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [activeSpace, setInspectorOpen, isGrabbing, selectedThoughtId, selectedThoughtIds, openModal, deleteThought, deleteSelectedThoughts, thoughts, addThought, setSelectedThoughtId, setSelectedThoughtIds, clearSelection, transform, isReadOnly, handleWheel, handleTouchStartLocal, handleTouchMove, handleTouchEnd, getGlobalScale, uploadThoughtBlob, applyConstraints, lastMousePos, selectionStartRef, isPanningRef, isSelectingRef]);

  return (
    <div
      id="viewport"
      className={cn(
        isDemo ? "absolute" : "fixed",
        "inset-0 z-[20] overflow-hidden",
        isGrabbing ? "pointer-events-auto cursor-grabbing" : "pointer-events-none"
      )}
    >

      {/* Selection Marquee */}
      {selectionRect && (
        <div
          className="fixed border-2 border-blue-500/50 bg-blue-500/10 z-[1001] pointer-events-none"
          style={{
            left: selectionRect.x,
            top: selectionRect.y,
            width: selectionRect.w,
            height: selectionRect.h,
          }}
        />
      )}

      {/* Moving Background Grid */}
      <div
        ref={registerGrid}
        className="absolute inset-0 dot-grid pointer-events-none opacity-[0.03]"
        style={{
          width: '5000px',
          height: '5000px',
          left: '-2500px',
          top: '-2500px',
          transformOrigin: 'center center'
        }}
      />
      <World
        canvasRef={canvasRef}
        physicsResults={{ registerElement, registerWorld, handleMouseDown, handleTouchStart, isDragging }}
      />

      {/* DROP ZONE OVERLAY */}
      <AnimatePresence>
        {isDraggingFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10006] bg-blue-500/10 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none border-[4px] border-dashed border-blue-500/30 m-4 rounded-[3rem]"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/30 shadow-[0_0_50px_rgba(99,102,241,0.2)]">
                <Upload className="w-10 h-10 text-blue-400 animate-bounce" />
              </div>
              <div className="text-center">
                <h2 className="text-white text-xl font-black uppercase tracking-[0.3em] mb-2">Import Files</h2>
                <p className="text-blue-300/60 text-xs font-bold uppercase tracking-widest">Drop images, text, or CSV files here</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      <AnimatePresence>
        {(isSpaceLoading && !isDemo) && (
          <motion.div

            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10005] bg-[#020408]/60 backdrop-blur-2xl flex flex-col items-center justify-center pointer-events-auto"
          >
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-blue-500/20 blur-[60px] rounded-full"
              />

              <div className="flex flex-col items-center gap-6 relative z-10">
                <div className="w-16 h-16 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />

                <div className="text-center">
                  <h2 className="text-white/80 text-[10px] font-black uppercase tracking-[0.5em] mb-2">Accessing Workspace</h2>
                  <div className="flex gap-1 justify-center">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        className="w-1 h-1 bg-blue-400 rounded-full"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Viewport;
