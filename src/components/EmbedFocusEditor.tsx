import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Youtube, X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EmbedFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const updateThought = useStore((state) => state.updateThought);

  const thought = thoughts.find((t) => t.id === activeFocusId);
  const stack = stacks.find((s) => s.id === thought?.stackId);
  const isVisible = focusType === 'embed' && !!thought;

  const [videoId, setVideoId] = useState<string | null>(null);

  useEffect(() => {
    if (thought?.content) {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = thought.content.match(regExp);
      setVideoId((match && match[2].length === 11) ? match[2] : null);
    } else {
      setVideoId(null);
    }
  }, [thought?.content]);

  return (
    <AnimatePresence>
      {isVisible && thought && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10001] bg-[var(--bg-main)]/70 backdrop-blur-[40px] flex items-center justify-center p-4 md:p-10"
          onClick={() => setActiveFocus(null, null)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="focus-box glass rounded-[2rem] md:rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl w-full max-w-[1200px] h-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 border-b border-white/5 bg-black/20 gap-4 md:gap-0">
              <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-red-500/10 rounded-xl md:rounded-2xl flex items-center justify-center text-red-500 flex-shrink-0">
                  <Youtube className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <input 
                    type="text" 
                    value={thought.text}
                    onChange={(e) => updateThought(thought.id, { text: e.target.value })}
                    className="bg-transparent text-xl md:text-2xl font-bold text-white outline-none border-none p-0 w-full" 
                    placeholder="Video Title"
                  />
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1 truncate">{thought.content || "No URL provided"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                {videoId && (
                  <a 
                    href={`https://www.youtube.com/watch?v=${videoId}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-3 md:p-4 hover:bg-white/5 rounded-xl md:rounded-2xl text-slate-400 hover:text-white transition-all"
                  >
                    <ExternalLink className="w-5 h-5 md:w-6 md:h-6" />
                  </a>
                )}
                <button 
                  onClick={() => setActiveFocus(null, null)}
                  className="p-3 md:p-4 hover:bg-red-500/10 rounded-xl md:rounded-2xl text-slate-400 hover:text-red-400 transition-all"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 bg-black relative">
              {videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                ></iframe>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-10">
                  <Youtube className="w-20 h-20 text-white/5 mb-6" />
                  <h3 className="text-xl font-bold text-white/40 mb-2">No Video URL Found</h3>
                  <p className="text-sm text-white/20 max-w-sm">Please paste a valid YouTube link in the thought settings to enable the player.</p>
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
              <p className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-slate-600 italic">Embedded via YouTube Player API</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EmbedFocusEditor;
