import React, { useState, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { useThoughtPayload } from '../thought/hooks/useThoughtPayload';
import { Download, Bold, Italic, List, ListOrdered, Link, Heading1, Heading2, Quote, Code, Eye, Edit3, Split } from 'lucide-react';
import { marked } from 'marked';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';
import { FocusEditorShell } from './FocusEditorShell';
import { type Thought } from '../../db';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface EditorToolbarProps {
  onAction: (type: string) => void;
  isReadOnly: boolean;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({ onAction, isReadOnly }) => {
  const tools = [
    { id: 'h1', icon: Heading1, label: 'H1' },
    { id: 'h2', icon: Heading2, label: 'H2' },
    { id: 'bold', icon: Bold, label: 'Bold' },
    { id: 'italic', icon: Italic, label: 'Italic' },
    { id: 'list', icon: List, label: 'Bullet List' },
    { id: 'ordered-list', icon: ListOrdered, label: 'Numbered List' },
    { id: 'quote', icon: Quote, label: 'Quote' },
    { id: 'code', icon: Code, label: 'Code' },
    { id: 'link', icon: Link, label: 'Link' },
  ];

  return (
    <div className="flex items-center gap-1 p-2 border-b border-[var(--glass-border)] bg-white/[0.01] overflow-x-auto no-scrollbar">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onAction(tool.id)}
          disabled={isReadOnly}
          title={tool.label}
          className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-all disabled:opacity-30"
        >
          <tool.icon className="w-4 h-4 md:w-4.5 md:h-4.5" />
        </button>
      ))}
    </div>
  );
};

const EditorContent: React.FC<{
  editMode: 'edit' | 'preview' | 'split';
  content: string;
  onContentChange: (val: string) => void;
  isReadOnly: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onToolbarAction: (type: string) => void;
}> = ({ editMode, content, onContentChange, isReadOnly, textareaRef, onToolbarAction }) => {
  const isSplit = editMode === 'split';
  const isPreviewOnly = editMode === 'preview';
  const isEditOnly = editMode === 'edit';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {!isPreviewOnly && <EditorToolbar onAction={onToolbarAction} isReadOnly={isReadOnly} />}
      <div className="flex-1 flex overflow-hidden">
        {(isEditOnly || isSplit) && (
          <div className={cn(
            "h-full overflow-y-auto custom-scroll transition-all duration-300",
            isSplit ? "w-1/2 border-r border-[var(--glass-border)]" : "w-full"
          )}>
            <div className="p-6 md:p-10 h-full max-w-4xl mx-auto">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => onContentChange(e.target.value)}
                readOnly={isReadOnly}
                className="w-full h-full bg-transparent text-lg md:text-xl text-[var(--text-primary)] leading-relaxed outline-none border-none resize-none placeholder:text-[var(--text-muted)]/30 font-['Plus_Jakarta_Sans',_sans-serif]"
                placeholder="Dive deep into your thoughts..."
                autoFocus
              />
            </div>
          </div>
        )}

        {(isPreviewOnly || isSplit) && (
          <div className={cn(
            "h-full overflow-y-auto custom-scroll bg-white/[0.01] transition-all duration-300",
            isSplit ? "w-1/2" : "w-full"
          )}>
            <div className="p-8 md:p-16 h-full max-w-4xl mx-auto">
              <div
                className="focus-markdown-body prose prose-invert prose-slate max-w-none text-sm md:text-base break-words"
                dangerouslySetInnerHTML={{ __html: marked.parse(content || "_No content yet. Start writing..._") as string }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TextFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const updateThought = useStore((state) => state.updateThought);
  const isReadOnly = useStore((state) => state.isReadOnly);

  const [editMode, setEditMode] = useState<'edit' | 'preview' | 'split'>('split');
  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadedThoughtIdRef = React.useRef<string | null>(null);

  const thought = thoughts.find((t) => t.id === activeFocusId) as Thought | undefined;
  const { content } = useThoughtPayload(thought as Thought);
  const stack = stacks.find((s) => s.id === thought?.stackId);
  const isVisible = focusType === 'text' && !!thought;

  React.useEffect(() => {
    if (thought && loadedThoughtIdRef.current !== thought.id) {
      loadedThoughtIdRef.current = thought.id;
      setLocalTitle(thought.text);
      setLocalContent(content);
    }
  }, [thought?.id, content]);

  const handleTitleChange = (val: string) => {
    setLocalTitle(val);
    if (!isReadOnly && thought) {
      updateThought(thought.id, { text: val });
    }
  };

  const handleContentChange = (val: string) => {
    setLocalContent(val);
    if (!isReadOnly && thought) {
      updateThought(thought.id, { data: { type: 'text', content: val } });
    }
  };

  const insertText = (before: string, after: string = '') => {
    if (!textareaRef.current) return;
    const { selectionStart, selectionEnd } = textareaRef.current;
    const currentText = localContent;
    const selected = currentText.substring(selectionStart, selectionEnd);
    const newText = 
      currentText.substring(0, selectionStart) + 
      before + selected + after + 
      currentText.substring(selectionEnd);
    
    handleContentChange(newText);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = selectionStart + before.length + selected.length + after.length;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleToolbarAction = (type: string) => {
    switch (type) {
      case 'h1': insertText('# ', ''); break;
      case 'h2': insertText('## ', ''); break;
      case 'bold': insertText('**', '**'); break;
      case 'italic': insertText('*', '*'); break;
      case 'list': insertText('- ', ''); break;
      case 'ordered-list': insertText('1. ', ''); break;
      case 'quote': insertText('> ', ''); break;
      case 'code': insertText('```\n', '\n```'); break;
      case 'link': insertText('[', '](url)'); break;
    }
  };

  const exportTXT = () => {
    if (!thought) return;
    const blob = new Blob([localContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${thought.text || 'note'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMD = () => {
    if (!thought) return;
    const blob = new Blob([localContent], { type: 'text/markdown' });
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
            { id: 'edit', label: 'Write', icon: Edit3 },
            { id: 'split', label: 'Split', icon: Split },
            { id: 'preview', label: 'Review', icon: Eye }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setEditMode(mode.id as 'edit' | 'preview' | 'split')}
              disabled={isReadOnly && mode.id !== 'preview'}
              className={cn(
                "relative px-3 md:px-5 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-semibold tracking-widest transition-all duration-300 z-10 flex items-center gap-2",
                editMode === mode.id 
                  ? "text-[var(--accent-contrast)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                isReadOnly && mode.id !== 'preview' && "opacity-30 cursor-not-allowed"
              )}
            >
              {editMode === mode.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-lg md:rounded-xl bg-[var(--accent)] shadow-lg shadow-[var(--accent-glow)] z-[-1]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <mode.icon className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span className="hidden md:inline">{mode.label}</span>
            </button>
          ))}
        </div>
      }
      footerStatus={
        <p className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-[var(--text-muted)]">Live Markdown Environment</p>
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
        editMode={editMode}
        content={localContent}
        onContentChange={handleContentChange}
        isReadOnly={isReadOnly}
        textareaRef={textareaRef}
        onToolbarAction={handleToolbarAction}
      />
    </FocusEditorShell>
  );
};

export const TextEditorContent = EditorContent;

export default TextFocusEditor;


