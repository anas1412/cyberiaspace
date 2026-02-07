import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { aiService } from '../services/ai';
import { serializeWorkspace } from '../utils/contextBuilder';
import { parseAIError } from '../utils/errorParser';
import { X, Send, Shield, Loader2, Bot, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import type { Content } from '@google/generative-ai';

interface Message {
  role: 'user' | 'model';
  text: string;
}

const formatModelName = (name: string) => {
  if (name.includes('gemini-2.0-flash-lite')) return 'Flash Lite Model';
  if (name.includes('-3-flash')) return '3 Flash Model';
  if (name.includes('-3-pro')) return '3 Pro Model';
  if (name.includes('-2.5-pro')) return '2.5 Model';
  if (name.includes('-2.5-flash')) return '2.5 Flash Model';
  if (name.includes('-2.5-flash-lite')) return '2.5 Flash Lite Model';
  
  return name;
};

const ChatOverlay: React.FC = () => {
  const isChatOpen = useStore((state) => state.isChatOpen);
  const setChatOpen = useStore((state) => state.setChatOpen);
  const oracleMode = useStore((state) => state.oracleMode);
  const apiKey = useStore((state) => state.apiKey);
  const activeModel = useStore((state) => state.activeModel);
  
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Content[]>([]);
  const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Oracle is processing...');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayMessages, isChatOpen, loading, status]);

  const handleSend = async () => {
    if (!input.trim() || !apiKey || loading) return;

    const userText = input;
    setDisplayMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setLoading(true);
    setStatus('Oracle is processing...');

    try {
      const { activeSpaceId, thoughts, spaces, stacks } = useStore.getState();
      const workspaceContext = serializeWorkspace(activeSpaceId, thoughts, spaces, stacks);
      const prompt = `[SYSTEM CONTEXT]\nCurrent Workspace State (JSON):\n${workspaceContext}\n[/SYSTEM CONTEXT]\n\n${userText}`;

      setDisplayMessages(prev => [...prev, { role: 'model', text: '' }]);
      
      const result = await aiService.sendMessageStream(
        prompt, 
        history, // New stateless history position
        (chunkText: string) => {
          setDisplayMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1] = { role: 'model', text: chunkText };
            return newMsgs;
          });
        },
        (newStatus: string) => setStatus(newStatus)
      );
      
      setHistory(result.history);
      setDisplayMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { role: 'model', text: result.text || "Workspace updated." };
        return newMsgs;
      });
    } catch (err: any) {
      const friendlyError = parseAIError(err);
      if (err.message?.includes('400') || err.message?.includes('turn')) {
        setHistory([]);
      }
      setDisplayMessages(prev => {
        const newMsgs = [...prev];
        if (newMsgs[newMsgs.length - 1]?.text === '') {
          newMsgs.pop();
        }
        return [...newMsgs, { role: 'model', text: `**Oracle Error:** ${friendlyError}` }];
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setHistory([]);
    setDisplayMessages([]);
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
          <div className="md:hidden flex justify-center pt-4 pb-2" onClick={() => setChatOpen(false)}>
            <div className="w-12 h-1.5 bg-white/10 rounded-full" />
          </div>

          <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--accent)]/20 flex items-center justify-center border border-[var(--accent)]/50">
                <Bot className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">Cyberia Oracle</h3>
                <p className="text-[10px] text-[var(--accent)] font-mono uppercase tracking-wider">{formatModelName(activeModel)} is Active</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {displayMessages.length > 0 && (
                <button 
                  onClick={handleClear}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-500 hover:text-white"
                  title="Clear Conversation"
                >
                  <History className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={() => setChatOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scroll" ref={scrollRef}>
            {displayMessages.length === 0 && (
              <div className="text-center text-slate-500 mt-10 md:mt-20">
                <Shield className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">Oracle Mode Enabled</p>
                <p className="text-xs mt-2 opacity-60 px-10">I can help you organize your workspace.</p>
              </div>
            )}
            
            {displayMessages.map((msg, i) => {
              if (!msg.text && msg.role === 'model') return null;
              return (
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
              );
            })}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />
                  <span className="text-xs text-slate-400">{status}</span>
                </div>
              </div>
            )}
          </div>

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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatOverlay;
