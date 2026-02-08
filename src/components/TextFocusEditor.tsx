import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { FileText, X } from 'lucide-react';
import { marked } from 'marked';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TextFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const updateThought = useStore((state) => state.updateThought);

  const [isEditMode, setIsEditMode] = useState(false);
  
  // Local state for instant feedback
  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');

  const thought = thoughts.find((t) => t.id === activeFocusId);
  const stack = stacks.find((s) => s.id === thought?.stackId);
  const isVisible = focusType === 'text' && !!thought;

  // Sync local state when thought changes (e.g., opening editor)
  React.useEffect(() => {
    if (thought) {
      setLocalTitle(thought.text);
      setLocalContent(thought.content);
    }
  }, [activeFocusId]);

  return (
    <AnimatePresence>
      {isVisible && thought && (
        <motion.div 
          id="text-focus-overlay" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[10001] bg-[var(--bg-main)]/70 backdrop-blur-[40px] flex items-center justify-center p-4 md:p-10"
          onClick={() => setActiveFocus(null, null)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="focus-box glass rounded-[2rem] md:rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl w-full max-w-[1000px] h-full max-h-[95vh] md:max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 border-b border-white/5 bg-black/20 gap-4 md:gap-0">
              <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-[var(--accent)]/10 rounded-xl md:rounded-2xl flex items-center justify-center text-[var(--accent-secondary)] flex-shrink-0">
                  <FileText className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <input 
                  type="text" 
                  value={localTitle}
                  onChange={(e) => {
                    setLocalTitle(e.target.value);
                    updateThought(thought.id, { text: e.target.value });
                  }}
                  className="bg-transparent text-xl md:text-2xl font-bold text-white outline-none border-none p-0 flex-1 md:w-[400px]" 
                  placeholder="Untitled Thought"
                />
              </div>
              <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
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
                    className={cn(
                      "px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all",
                      isEditMode ? "bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent-glow)]" : "text-slate-500 hover:text-white"
                    )}
                  >
                    Edit
                  </button>
                </div>
                <button 
                  onClick={() => setActiveFocus(null, null)}
                  className="p-3 md:p-4 hover:bg-red-500/10 rounded-xl md:rounded-2xl text-slate-400 hover:text-red-400 transition-all"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              {isEditMode ? (
                <div className="flex-1 p-6 md:p-10 overflow-y-auto custom-scroll bg-white/[0.02]">
                  <textarea 
                    value={localContent}
                    onChange={(e) => {
                      setLocalContent(e.target.value);
                      updateThought(thought.id, { content: e.target.value });
                    }}
                    className="w-full h-full bg-transparent text-lg md:text-xl text-slate-200 leading-relaxed outline-none border-none resize-none placeholder:text-slate-700 font-['Plus_Jakarta_Sans',_sans-serif]" 
                    placeholder="Dive deep into your thoughts..."
                    autoFocus
                  />
                </div>
              ) : (
                <div className="flex-1 p-8 md:p-20 overflow-y-auto custom-scroll bg-black/20">
                  <div 
                    className="focus-markdown-body max-w-3xl mx-auto text-sm md:text-base"
                    dangerouslySetInnerHTML={{ __html: marked.parse(thought.content || "_No content yet. Click Edit to start writing..._") as string }}
                  />
                </div>
              )}
            </div>
            
            <div className="p-4 md:p-6 bg-black/40 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                {stack && (
                  <span 
                    className="tag-pill text-[8px] md:text-[9px] font-700 px-2 md:px-2.5 py-1 rounded-lg border border-white/10" 
                    style={{
                      backgroundColor: stack.color.replace('1)', '0.15)'),
                      color: stack.color,
                      borderColor: stack.color.replace('1)', '0.3)')
                    }}
                  >
                    {stack.name}
                  </span>
                )}
              </div>
              <p className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-slate-600">Markdown Rendering Supported</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TextFocusEditor;