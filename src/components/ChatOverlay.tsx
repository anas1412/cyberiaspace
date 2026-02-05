import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { aiService } from '../services/ai';
import { serializeWorkspace } from '../utils/contextBuilder';
import { parseAIError } from '../utils/errorParser';
import { X, Send, Eye, Shield, Loader2, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toPng } from 'html-to-image';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'model';
  text: string;
}

const formatModelName = (name: string) => {
  if (name.includes('gemini-3-flash')) return '3 Flash';
  if (name.includes('gemini-3-pro')) return '3 Pro';
  if (name.includes('gemini-2.5-pro')) return '2.5 Pro';
  if (name.includes('gemini-flash-lite-latest')) return '2.5 Flash Lite Latest';
  if (name.includes('gemini-flash-latest')) return '2.5 Flash Latest';
  if (name.includes('gemini-2.5-flash-lite')) return '2.5 Flash Lite';
  if (name.includes('gemini-2.5-flash')) return '2.5 Flash';
  return name;
};

const ChatOverlay: React.FC = () => {
  const isChatOpen = useStore((state) => state.isChatOpen);
  const setChatOpen = useStore((state) => state.setChatOpen);
  const oracleMode = useStore((state) => state.oracleMode);
  const apiKey = useStore((state) => state.apiKey);
  const activeModel = useStore((state) => state.activeModel);
  
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [includeVision, setIncludeVision] = useState(true);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const tips = [
    "Ask Oracle to reorganize your workspace",
    "Press [Space] to spawn a new thought",
    "Link nodes to form physical clusters",
    "Double-click nodes for deep editing",
    "Paste images, text, youtube links",
    "Toggle Shield icon for local-only mode"
  ];

  // Rotate tips
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [tips.length]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isChatOpen]);

  const handleSend = async () => {
    if (!input.trim() || !apiKey || loading) return;

    const userMsg: Message = { role: 'user', text: input };
    setHistory(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let imageBase64: string | undefined;

      // Vision Capture
      if (includeVision) {
        const viewport = document.getElementById('viewport');
        if (viewport) {
           try {
             // Basic settings for speed
             imageBase64 = await toPng(viewport, { 
               pixelRatio: 0.5,
               cacheBust: true,
               skipAutoScale: true
             });
           } catch (e) {
             console.error("Vision capture failed", e);
           }
        }
      }

      // Build Context
      const { activeSpaceId, thoughts, spaces } = useStore.getState();
      const workspaceContext = serializeWorkspace(activeSpaceId, thoughts, spaces);
      
      const prompt = `
[SYSTEM CONTEXT]
Current Workspace State (JSON):
${workspaceContext}
[/SYSTEM CONTEXT]

${userMsg.text}
`;

      // Send to Gemini
      const response = await aiService.sendMessage(prompt, imageBase64);
      
      setHistory(prev => [...prev, { role: 'model', text: response }]);
    } catch (err: any) {
      const friendlyError = parseAIError(err);
      setHistory(prev => [...prev, { role: 'model', text: `**Oracle Error:** ${friendlyError}` }]);
      console.error("[Oracle Debug]", err);
    } finally {
      setLoading(false);
    }
  };

  if (!oracleMode) return null;

  return (
    <AnimatePresence>
      {isChatOpen && (
        <motion.div
          id="chat-overlay"
          initial={typeof window !== 'undefined' && window.innerWidth < 768 ? { y: '100%' } : { opacity: 0, scale: 0.9, y: 20 }}
          animate={typeof window !== 'undefined' && window.innerWidth < 768 ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
          exit={typeof window !== 'undefined' && window.innerWidth < 768 ? { y: '100%' } : { opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-0 md:inset-auto md:bottom-24 md:right-8 w-full md:w-96 h-full md:h-[600px] glass md:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden z-[9999]"
        >
          {/* Mobile Close Handle */}
          <div className="md:hidden flex justify-center pt-4 pb-2" onClick={() => setChatOpen(false)}>
            <div className="w-12 h-1.5 bg-white/10 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--accent)]/20 flex items-center justify-center border border-[var(--accent)]/50">
                <Bot className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">Cyberia Oracle</h3>
                <p className="text-[10px] text-[var(--accent)] font-mono uppercase tracking-wider">{formatModelName(activeModel)} Active</p>
              </div>
            </div>
            <button 
              onClick={() => setChatOpen(false)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scroll" ref={scrollRef}>
            {history.length === 0 && (
              <div className="text-center text-slate-500 mt-10 md:mt-20">
                <Shield className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">Oracle Mode Enabled</p>
                <p className="text-xs mt-2 opacity-60 px-10">I can see your workspace and help you organize.</p>
              </div>
            )}
            
            {history.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`
                    max-w-[90%] md:max-w-[85%] p-3 md:p-4 rounded-2xl text-sm leading-relaxed prose prose-invert
                    ${msg.role === 'user' 
                      ? 'bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-white rounded-tr-sm' 
                      : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-sm'}
                  `}
                >
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />
                  <span className="text-xs text-slate-400">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 pb-8 md:pb-4 border-t border-white/5 bg-black/20">
            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask Oracle..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white outline-none focus:border-[var(--accent)]/50 resize-none h-14 custom-scroll md:h-14"
              />
              <button 
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="absolute right-2 top-2 p-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent)]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mt-2 flex items-center justify-between px-1 overflow-hidden">
              <label 
                className="flex items-center gap-2 cursor-pointer group flex-shrink-0"
                onClick={() => setIncludeVision(!includeVision)}
              >
                <div 
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${includeVision ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-slate-600 group-hover:border-slate-500'}`}
                >
                  {includeVision && <Eye className="w-2.5 h-2.5 text-white" />}
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 group-hover:text-slate-400 select-none whitespace-nowrap">
                  Vision
                </span>
              </label>

              <div className="flex items-center gap-1.5 text-[9px] font-medium text-slate-500 italic select-none overflow-hidden">
                <span className="opacity-40 flex-shrink-0 whitespace-nowrap">Tip:</span>
                <AnimatePresence mode="wait">
                  <motion.span 
                    key={currentTipIndex}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-slate-400 truncate block whitespace-nowrap"
                  >
                    {!activeModel.includes('gemini-3') && currentTipIndex === 0
                      ? "Use Gemini 3 for better reasoning" 
                      : tips[currentTipIndex]}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatOverlay;
