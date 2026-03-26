import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useThoughtPayload } from '../thought/hooks/useThoughtPayload';
import { Download } from 'lucide-react';
import { marked } from 'marked';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';
import { FocusEditorShell } from './FocusEditorShell';
import { db } from '../../db';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const EditorContent: React.FC<{
  isEditMode: boolean;
  content: string;
  onContentChange: (val: string) => void;
  isReadOnly: boolean;
}> = ({ isEditMode, content, onContentChange, isReadOnly }) => (
  <div className="flex-1 flex overflow-hidden">
    {isEditMode ? (
      <div className="flex-1 p-6 md:p-10 overflow-y-auto custom-scroll bg-white/[0.02]">
        <div className="max-w-4xl mx-auto h-full">
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            readOnly={isReadOnly}
            className="w-full h-full bg-transparent text-lg md:text-xl text-[var(--text-primary)] leading-relaxed outline-none border-none resize-none placeholder:text-[var(--text-muted)]/30 font-['Plus_Jakarta_Sans',_sans-serif]"
            placeholder="Dive deep into your thoughts..."
            autoFocus
          />
        </div>
      </div>
    ) : (
      <div className="flex-1 p-8 md:p-20 overflow-y-auto custom-scroll bg-black/20">
        <div
          className="focus-markdown-body max-w-4xl mx-auto text-sm md:text-base break-words"
          dangerouslySetInnerHTML={{ __html: marked.parse(content || "_No content yet. Click Edit to start writing..._") as string }}
        />
      </div>
    )}
  </div>
);

const TextFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const patchThought = useStore((state) => state.patchThought);
  const isReadOnly = useStore((state) => state.isReadOnly);

  const [isEditMode, setIsEditMode] = useState(false);
  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');

  const thought = thoughts.find((t) => t.id === activeFocusId);
  const { content } = useThoughtPayload(thought as any);
  const stack = stacks.find((s) => s.id === thought?.stackId);
  const isVisible = focusType === 'text' && !!thought;

  React.useEffect(() => {
    if (thought) {
      setLocalTitle(thought.text);
      setLocalContent(content);
    }
  }, [activeFocusId, thought, content]);

  const handleTitleChange = (val: string) => {
    setLocalTitle(val);
    if (!isReadOnly && thought) {
      // Instant store update
      patchThought(thought.id, { text: val });
      
      // Debounced DB save
      const timerKey = `title-save-${thought.id}`;
      if ((window as any)[timerKey]) clearTimeout((window as any)[timerKey]);
      (window as any)[timerKey] = setTimeout(async () => {
        await db.thoughts.update(thought.id, { 
          text: val,
          updatedAt: Date.now(),
          syncStatus: 'local'
        });
        delete (window as any)[timerKey];
      }, 1000);
    }
  };

  const handleContentChange = (val: string) => {
    setLocalContent(val);
    if (!isReadOnly && thought) {
      // Instant store update
      patchThought(thought.id, { data: { type: 'text', content: val } });
      
      // Debounced DB save
      const timerKey = `content-save-${thought.id}`;
      if ((window as any)[timerKey]) clearTimeout((window as any)[timerKey]);
      (window as any)[timerKey] = setTimeout(async () => {
        await db.thoughts.update(thought.id, { 
          data: { type: 'text', content: val },
          updatedAt: Date.now(),
          syncStatus: 'local'
        });
        delete (window as any)[timerKey];
      }, 1000);
    }
  };


  const exportTXT = () => {
    if (!thought) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${thought.text || 'note'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMD = () => {
    if (!thought) return;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${thought.text || 'note'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!thought) return null;

  return (
    <FocusEditorShell
      isVisible={isVisible}
      onClose={() => setActiveFocus(null, null)}
      title={localTitle}
      onTitleChange={handleTitleChange}
      description={thought.description}
      isReadOnly={isReadOnly}
      stack={stack}
      headerActions={
        <div className="flex bg-[var(--bg-main)]/40 p-1 rounded-xl md:rounded-2xl border border-[var(--glass-border)] relative">
          {[
            { id: false, label: 'View' },
            { id: true, label: 'Edit' }
          ].map((mode) => (
            <button
              key={mode.label}
              onClick={() => setIsEditMode(mode.id)}
              disabled={mode.id === true && isReadOnly}
                className={cn(
                  "relative px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all duration-300 z-10",
                  isEditMode === mode.id 
                    ? (mode.id === true ? "text-[var(--accent-contrast)]" : "text-[var(--text-primary)]")
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                  mode.id === true && isReadOnly && "opacity-30 cursor-not-allowed"
                )}
            >
              {isEditMode === mode.id && (
                <motion.div
                  layoutId="activeTab"
                  className={cn(
                    "absolute inset-0 rounded-lg md:rounded-xl shadow-lg z-[-1]",
                    mode.id === true 
                      ? "bg-[var(--accent)] shadow-[var(--accent-glow)]" 
                      : "bg-white/10 border border-white/10"
                  )}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              {mode.label}
            </button>
          ))}
        </div>
      }
      footerStatus={
        <p className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-[var(--text-muted)]">Markdown Rendering Supported</p>
      }
      footerActions={
        <div className="flex items-center gap-4">
          <button onClick={exportTXT} className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-[var(--text-dimmed)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-2">
            <Download className="w-3.5 h-3.5" /> TXT
          </button>
          <button onClick={exportMD} className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-[var(--text-dimmed)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-2">
            <Download className="w-3.5 h-3.5" /> MD
          </button>
        </div>
      }
    >
      <EditorContent 
        isEditMode={isEditMode}
        content={localContent}
        onContentChange={handleContentChange}
        isReadOnly={isReadOnly}
      />
    </FocusEditorShell>
  );
};

export default TextFocusEditor;
