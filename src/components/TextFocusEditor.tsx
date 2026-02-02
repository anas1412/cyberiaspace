import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { FileText, X } from 'lucide-react';
import { marked } from 'marked';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getTagStyle = (tag: string) => {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = tag.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h * 137.5) % 360;
  return {
    backgroundColor: `hsla(${hue}, 70%, 50%, 0.15)`,
    color: `hsla(${hue}, 90%, 75%, 1)`,
    borderColor: `hsla(${hue}, 70%, 50%, 0.3)`,
  };
};

const TextFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const thoughts = useStore((state) => state.thoughts);
  const updateThought = useStore((state) => state.updateThought);

  const [isEditMode, setIsEditMode] = useState(false);

  const thought = thoughts.find((t) => t.id === activeFocusId);

  if (focusType !== 'text' || !thought) return null;

  return (
    <div 
      id="text-focus-overlay" 
      className="fixed inset-0 z-[10001] bg-black/95 backdrop-blur-[40px] flex items-center justify-center p-10 opacity-100 transition-opacity duration-400"
      onClick={() => setActiveFocus(null, null)}
    >
      <div 
        className="focus-box glass rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl w-full max-w-[1000px] h-full max-h-[85vh] flex flex-col transform scale-100 transition-transform duration-400"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-8 border-b border-white/5">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400">
              <FileText className="w-6 h-6" />
            </div>
            <input 
              type="text" 
              value={thought.text}
              onChange={(e) => updateThought(thought.id, { text: e.target.value })}
              className="bg-transparent text-2xl font-bold text-white outline-none border-none p-0 w-[400px]" 
              placeholder="Untitled Thought"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
              <button 
                onClick={() => setIsEditMode(false)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  !isEditMode ? "bg-slate-700 text-white" : "text-slate-500 hover:text-white"
                )}
              >
                View
              </button>
              <button 
                onClick={() => setIsEditMode(true)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  isEditMode ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 hover:text-white"
                )}
              >
                Edit
              </button>
            </div>
            <button 
              onClick={() => setActiveFocus(null, null)}
              className="p-4 hover:bg-red-500/10 rounded-2xl text-slate-400 hover:text-red-400 transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 flex overflow-hidden">
          {isEditMode ? (
            <div className="flex-1 p-10 overflow-y-auto custom-scroll bg-white/[0.02]">
              <textarea 
                value={thought.content}
                onChange={(e) => updateThought(thought.id, { content: e.target.value })}
                className="w-full h-full bg-transparent text-xl text-slate-200 leading-relaxed outline-none border-none resize-none placeholder:text-slate-700 font-['Plus_Jakarta_Sans',_sans-serif]" 
                placeholder="Dive deep into your thoughts..."
                autoFocus
              />
            </div>
          ) : (
            <div className="flex-1 p-20 overflow-y-auto custom-scroll bg-black/20">
              <div 
                className="focus-markdown-body max-w-3xl mx-auto"
                dangerouslySetInnerHTML={{ __html: marked.parse(thought.content || "_No content yet. Click Edit to start writing..._") as string }}
              />
            </div>
          )}
        </div>
        
        <div className="p-6 bg-black/40 border-t border-white/5 flex justify-between items-center">
          <div className="flex gap-2">
            {thought.tags.map((tag, i) => (
              <span key={i} className="tag-pill text-[9px] font-700 px-2.5 py-1 rounded-lg border border-white/10" style={getTagStyle(tag)}>
                {tag}
              </span>
            ))}
          </div>
          <p className="text-[10px] uppercase font-black tracking-widest text-slate-600">Auto-saving to IndexedDB</p>
        </div>
      </div>
    </div>
  );
};

export default TextFocusEditor;
