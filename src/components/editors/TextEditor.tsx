import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useThoughtPayload } from '../thought/hooks/useThoughtPayload';
import { Download, Bold, Italic, List, ListOrdered, Link, Heading1, Heading2, Quote, Code, Eye, Edit3, Split, X } from 'lucide-react';
import { marked } from 'marked';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';
import { type Thought } from '../../db';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// TOOLBAR
// ============================================================================

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
    <div className="flex items-center gap-1 p-1.5 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl overflow-x-auto no-scrollbar w-fit">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onAction(tool.id)}
          disabled={isReadOnly}
          title={tool.label}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-page)]/30 transition-all disabled:opacity-30"
        >
          <tool.icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// TEXT EDITOR
// ============================================================================

interface TextEditorProps {
  thought: Thought;
  onClose: () => void;
}

const TextEditor: React.FC<TextEditorProps> = ({ thought, onClose }) => {
  const updateThought = useStore((state) => state.updateThought);
  const isReadOnly = useStore((state) => state.isReadOnly);

  const [editMode, setEditMode] = useState<'edit' | 'preview' | 'split'>('split');
  const [localTitle, setLocalTitle] = useState(thought.text);
  const [localContent, setLocalContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadedThoughtIdRef = useRef<string | null>(null);

  const { content } = useThoughtPayload(thought);

  // Sync thought to local state when thought changes
  useEffect(() => {
    if (loadedThoughtIdRef.current !== thought.id) {
      loadedThoughtIdRef.current = thought.id;
      setLocalTitle(thought.text);
      setLocalContent(content);
    }
  }, [thought.id, content]);

  // Escape key closes the editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleTitleChange = (val: string) => {
    setLocalTitle(val);
    if (!isReadOnly) {
      updateThought(thought.id, { text: val });
    }
  };

  const handleContentChange = (val: string) => {
    setLocalContent(val);
    if (!isReadOnly) {
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
    const blob = new Blob([localContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${thought.text || 'note'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMD = () => {
    const blob = new Blob([localContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${thought.text || 'note'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isPreviewOnly = editMode === 'preview';
  const isEditOnly = editMode === 'edit';
  const isSplit = editMode === 'split';

  return (
    <div className="flex flex-col h-full">
      {/* Header: Title + Mode Toggle + Close */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--glass-border)] shrink-0 gap-4">
        <input
          type="text"
          value={localTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          readOnly={isReadOnly}
          className="flex-1 bg-transparent border-none outline-none text-[13px] font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/30 min-w-0"
        />
        <div className="flex items-center gap-1">
          <div className="flex bg-[var(--bg-main)]/40 p-0.5 rounded-lg border border-[var(--glass-border)] relative">
            {[
              { id: 'edit' as const, label: 'Write', icon: Edit3 },
              { id: 'split' as const, label: 'Split', icon: Split },
              { id: 'preview' as const, label: 'Review', icon: Eye }
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setEditMode(mode.id)}
                disabled={isReadOnly && mode.id !== 'preview'}
                className={cn(
                  "relative px-2.5 py-1.5 rounded-md text-[9px] font-semibold tracking-widest transition-all duration-300 z-10 flex items-center gap-1.5",
                  editMode === mode.id
                    ? "text-[var(--accent-contrast)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                  isReadOnly && mode.id !== 'preview' && "opacity-30 cursor-not-allowed"
                )}
              >
                {editMode === mode.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-md bg-[var(--accent)] shadow-lg shadow-[var(--accent)]/20 z-[-1]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <mode.icon className="w-3 h-3" />
                <span>{mode.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-all"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content area - scrolls independently */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto px-6 py-6 flex flex-col gap-4">
          {/* Floating toolbar */}
          {!isPreviewOnly && (
            <div className="flex-shrink-0">
              <EditorToolbar onAction={handleToolbarAction} isReadOnly={isReadOnly} />
            </div>
          )}

          {/* Editor / Preview panes */}
          <div className="flex-1 min-h-0 flex overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-main)]/30">
            {/* Edit pane */}
            {(isEditOnly || isSplit) && (
              <div className={cn(
                "h-full overflow-y-auto custom-scroll transition-all duration-300",
                isSplit ? "w-1/2 border-r border-[var(--glass-border)]" : "w-full"
              )}>
                <div className="p-6 h-full">
                  <textarea
                    ref={textareaRef}
                    value={localContent}
                    onChange={(e) => handleContentChange(e.target.value)}
                    readOnly={isReadOnly}
                    className="w-full h-full bg-transparent text-base md:text-lg text-[var(--text-primary)] leading-relaxed outline-none border-none resize-none placeholder:text-[var(--text-muted)]/30 font-['Plus_Jakarta_Sans',_sans-serif]"
                    placeholder="Dive deep into your thoughts..."
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Preview pane */}
            {(isPreviewOnly || isSplit) && (
              <div className={cn(
                "h-full overflow-y-auto custom-scroll bg-white/[0.01] transition-all duration-300",
                isSplit ? "w-1/2" : "w-full"
              )}>
                <div className="p-6 md:p-8 h-full">
                  <div
                    className="focus-markdown-body prose prose-invert prose-slate max-w-none text-sm md:text-base break-words"
                    dangerouslySetInnerHTML={{ __html: marked.parse(localContent || "_No content yet. Start writing..._") as string }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Export links - text links at the bottom, not a chrome footer */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-3 border-t border-[var(--glass-border)]">
        <button
          onClick={exportTXT}
          className="text-[10px] uppercase font-semibold tracking-widest text-[var(--text-dimmed)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5"
        >
          <Download className="w-3 h-3" />
          Export TXT
        </button>
        <span className="text-[var(--text-muted)] text-[8px] select-none">·</span>
        <button
          onClick={exportMD}
          className="text-[10px] uppercase font-semibold tracking-widest text-[var(--text-dimmed)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5"
        >
          <Download className="w-3 h-3" />
          Export MD
        </button>
      </div>
    </div>
  );
};

export default TextEditor;
