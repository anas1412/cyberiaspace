import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { FileText, Download } from 'lucide-react';
import { marked } from 'marked';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FocusEditorShell } from './FocusEditorShell';

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
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          readOnly={isReadOnly}
          className="w-full h-full bg-transparent text-lg md:text-xl text-slate-200 leading-relaxed outline-none border-none resize-none placeholder:text-slate-700 font-['Plus_Jakarta_Sans',_sans-serif]"
          placeholder="Dive deep into your thoughts..."
          autoFocus
        />
      </div>
    ) : (
      <div className="flex-1 p-8 md:p-20 overflow-y-auto custom-scroll bg-black/20">
        <div
          className="focus-markdown-body max-w-3xl mx-auto text-sm md:text-base"
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
  const updateThought = useStore((state) => state.updateThought);
  const isReadOnly = useStore((state) => state.isReadOnly);

  const [isEditMode, setIsEditMode] = useState(false);
  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');

  const thought = thoughts.find((t) => t.id === activeFocusId);
  const stack = stacks.find((s) => s.id === thought?.stackId);
  const isVisible = focusType === 'text' && !!thought;

  React.useEffect(() => {
    if (thought) {
      setLocalTitle(thought.text);
      setLocalContent(thought.content);
    }
  }, [activeFocusId]);

  const handleTitleChange = (val: string) => {
    setLocalTitle(val);
    if (!isReadOnly && thought) updateThought(thought.id, { text: val });
  };

  const handleContentChange = (val: string) => {
    setLocalContent(val);
    if (!isReadOnly && thought) {
      // Debounce the global store update to reduce lag
      const timerKey = `content-save-${thought.id}`;
      if ((window as any)[timerKey]) clearTimeout((window as any)[timerKey]);
      (window as any)[timerKey] = setTimeout(() => {
        updateThought(thought.id, { content: val });
        delete (window as any)[timerKey];
      }, 1000); // 1 second debounce for heavy content
    }
  };


  const exportTXT = () => {
    if (!thought) return;
    const blob = new Blob([thought.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${thought.text || 'note'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!thought) return null;

  return (
    <FocusEditorShell
      isVisible={isVisible}
      onClose={() => setActiveFocus(null, null)}
      icon={FileText}
      title={localTitle}
      onTitleChange={handleTitleChange}
      description={thought.description}
      isReadOnly={isReadOnly}
      stack={stack}
      headerActions={
        <div className="flex bg-white/5 p-1 rounded-xl md:rounded-2xl border border-white/5">
          <button
            onClick={() => setIsEditMode(false)}
            className={cn(
              "px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all",
              !isEditMode ? "bg-slate-700 text-white" : "text-slate-500 hover:text-white"
            )}
          >
            View
          </button>
          <button
            onClick={() => setIsEditMode(true)}
            disabled={isReadOnly}
            className={cn(
              "px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all",
              isEditMode ? "bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent-glow)]" : "text-slate-500 hover:text-white",
              isReadOnly && "opacity-30 cursor-not-allowed"
            )}
          >
            Edit
          </button>
        </div>
      }
      footerStatus={
        <p className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-slate-600">Markdown Rendering Supported</p>
      }
      footerActions={
        <button onClick={exportTXT} className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-white transition-colors flex items-center gap-2">
          <Download className="w-3.5 h-3.5" /> TXT
        </button>
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
