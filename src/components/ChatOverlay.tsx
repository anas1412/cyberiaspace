import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { aiService } from '../services/ai';
import { serializeWorkspace } from '../utils/contextBuilder';
import { X, Send, Eye, Shield, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toPng } from 'html-to-image';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'model';
  text: string;
}

const formatModelName = (name: string) => {
  if (name.includes('gemini-3-pro')) return 'Gemini 3 Pro';
  if (name.includes('gemini-3-flash')) return 'Gemini 3 Flash';
  if (name.includes('gemini-2.5-pro')) return 'Gemini 2.5 Pro';
  if (name.includes('gemini-2.5-flash-lite')) return 'Gemini 2.5 Flash Lite';
  if (name.includes('gemini-2.5-flash')) return 'Gemini 2.5 Flash';
  if (name.includes('flash-lite')) return 'Flash Lite';
  if (name.includes('flash')) return 'Flash';
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
  
  const scrollRef = useRef<HTMLDivElement>(null);

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
    } catch (err) {
      setHistory(prev => [...prev, { role: 'model', text: 'Error: Failed to connect to Cyberia Oracle. Check your API Key or connection.' }]);
      console.error(err);
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
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-24 right-8 w-96 h-[600px] glass rounded-[2rem] shadow-2xl flex flex-col overflow-hidden z-[9999]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--accent)]/20 flex items-center justify-center border border-[var(--accent)]/50">
                <Sparkles className="w-5 h-5 text-[var(--accent)]" />
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
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scroll" ref={scrollRef}>
            {history.length === 0 && (
              <div className="text-center text-slate-500 mt-20">
                <Shield className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">Oracle Mode Enabled</p>
                <p className="text-xs mt-2 opacity-60">I can see your workspace and help you organize.</p>
              </div>
            )}
            
            {history.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`
                    max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed prose prose-invert
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
          <div className="p-4 border-t border-white/5 bg-black/20">
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
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white outline-none focus:border-[var(--accent)]/50 resize-none h-14 custom-scroll"
              />
              <button 
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="absolute right-2 top-2 p-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent)]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mt-2 flex items-center gap-4 px-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div 
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${includeVision ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-slate-600 group-hover:border-slate-500'}`}
                  onClick={() => setIncludeVision(!includeVision)}
                >
                  {includeVision && <Eye className="w-2.5 h-2.5 text-white" />}
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 group-hover:text-slate-400 select-none">
                  Vision Context
                </span>
              </label>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatOverlay;
