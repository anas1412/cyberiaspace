import React from 'react';
import { Bold, Italic, List, ListOrdered, Link, Heading1, Heading2, Quote, Code } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { marked } from 'marked';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface EditorToolbarProps {
  onAction: (type: string) => void;
  isReadOnly: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ onAction, isReadOnly }) => {
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

interface TextEditorContentProps {
  editMode: 'edit' | 'preview' | 'split';
  content: string;
  onContentChange: (val: string) => void;
  isReadOnly: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onToolbarAction?: (type: string) => void;
}

export const TextEditorContent: React.FC<TextEditorContentProps> = ({
  editMode,
  content,
  onContentChange,
  isReadOnly,
  textareaRef,
  onToolbarAction
}) => {
  const isSplit = editMode === 'split';
  const isPreviewOnly = editMode === 'preview';
  const isEditOnly = editMode === 'edit';
  const showToolbar = !isPreviewOnly && !!onToolbarAction;

  const handleToolbarAction = (type: string) => {
    if (!onToolbarAction || !textareaRef?.current) return;
    
    const { selectionStart, selectionEnd } = textareaRef.current;
    const selected = content.substring(selectionStart, selectionEnd);
    let newText = '';
    let newCursorPos = selectionStart;
    
    switch (type) {
      case 'h1':
        newText = content.substring(0, selectionStart) + '# ' + selected + content.substring(selectionEnd);
        newCursorPos = selectionStart + 2;
        break;
      case 'h2':
        newText = content.substring(0, selectionStart) + '## ' + selected + content.substring(selectionEnd);
        newCursorPos = selectionStart + 3;
        break;
      case 'bold':
        newText = content.substring(0, selectionStart) + '**' + selected + '**' + content.substring(selectionEnd);
        newCursorPos = selectionStart + 2 + selected.length + 2;
        break;
      case 'italic':
        newText = content.substring(0, selectionStart) + '*' + selected + '*' + content.substring(selectionEnd);
        newCursorPos = selectionStart + 1 + selected.length + 1;
        break;
      case 'list':
        newText = content.substring(0, selectionStart) + '- ' + selected + content.substring(selectionEnd);
        newCursorPos = selectionStart + 2;
        break;
      case 'ordered-list':
        newText = content.substring(0, selectionStart) + '1. ' + selected + content.substring(selectionEnd);
        newCursorPos = selectionStart + 3;
        break;
      case 'quote':
        newText = content.substring(0, selectionStart) + '> ' + selected + content.substring(selectionEnd);
        newCursorPos = selectionStart + 2;
        break;
      case 'code':
        newText = content.substring(0, selectionStart) + '```\n' + selected + '\n```' + content.substring(selectionEnd);
        newCursorPos = selectionStart + 4;
        break;
      case 'link':
        newText = content.substring(0, selectionStart) + '[' + selected + '](url)' + content.substring(selectionEnd);
        newCursorPos = selectionStart + 1 + selected.length + 3;
        break;
    }
    
    if (newText) {
      onContentChange(newText);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {showToolbar && <EditorToolbar onAction={handleToolbarAction} isReadOnly={isReadOnly} />}
      <div className="flex-1 flex overflow-hidden">
        {(isEditOnly || isSplit) && (
          <div className={cn(
            "h-full overflow-y-auto custom-scroll transition-all duration-300",
            isSplit ? "w-1/2 border-r border-[var(--glass-border)]" : "w-full"
          )}>
            <div className="p-4 md:p-6 h-full max-w-4xl mx-auto">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => onContentChange(e.target.value)}
                readOnly={isReadOnly}
                className="w-full h-full bg-transparent text-base md:text-lg text-[var(--text-primary)] leading-relaxed outline-none border-none resize-none placeholder:text-[var(--text-muted)]/30 font-['Plus_Jakarta_Sans',_sans-serif]"
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
            <div className="p-6 md:p-10 h-full max-w-4xl mx-auto">
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