import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { serializeWorkspace } from '../utils/contextBuilder';
import { X, Send, Shield, Loader2, Bot, History, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PLAN_CONFIG } from '../constants';
import { executeOracleTool } from '../services/oracle/executor';

const SUGGESTIONS = [
  "Summarize my recent thoughts...",
  "Create a task list for my project...",
  "Find me the top 3 lo-fi tracks...",
  "Group all my notes about AI...",
  "Research the history of Cyberpunk...",
  "Build a table for my expenses...",
  "Add 3 inspirational quotes about tech...",
  "Link all my urgent tasks together...",
  "Clear all the thoughts in this space...",
  "Brainstorm 5 features for a new app..."
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const ChatOverlay: React.FC = () => {
  const isChatOpen = useStore((state) => state.isChatOpen);
  const setChatOpen = useStore((state) => state.setChatOpen);
  const oracleMode = useStore((state) => state.oracleMode);
  const store = useStore();
  const { user } = useAuthStore();
  const plan = user?.plan || 'free';
  const limits = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG];
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [dailyUsage, setDailyUsage] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Strict plan-based model selection
  const activeModel = plan === 'pro' ? 'openai/gpt-oss-120b' : 'openai/gpt-oss-20b';

  const suggestion = React.useMemo(() => 
    SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)], 
  [isChatOpen]);

  useEffect(() => {
    if (isChatOpen && user) {
      const authStore = useAuthStore.getState();
      fetch('/api/chat', {
        headers: { 'Authorization': `Bearer ${authStore.accessToken}` }
      })
      .then(res => res.json())
      .then(data => {
        if (typeof data.count === 'number') setDailyUsage(data.count);
      })
      .catch(err => console.error("[Oracle] Failed to fetch initial usage:", err));
    }
  }, [isChatOpen, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isChatOpen, isLoading]);

  const handleClear = () => {
    setMessages([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (plan === 'free' && dailyUsage >= (limits.AI_DAILY_LIMIT || 0)) {
      const errorMsg: Message = { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: "### Limit Reached\nChoom, you've hit your daily data-stream limit for the Free tier. Upgrade to **Pro** for unlimited neural access and premium models!" 
      };
      setMessages(prev => [...prev, { id: (Date.now() - 1).toString(), role: 'user', content: input }, errorMsg]);
      setInput('');
      return;
    }

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStatus('thinking');

    try {
      const authStore = useAuthStore.getState();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.accessToken}`
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          model: activeModel,
          plan: plan,
          context: serializeWorkspace(
            store.activeSpaceId, 
            store.thoughts, 
            store.spaces, 
            store.stacks
          )
        }),
      });

      if (response.status === 429) {
        const errorData = await response.json();
        const errorMsg: Message = { 
          id: Date.now().toString(), 
          role: 'assistant', 
          content: `### Neural Link Saturated\n${errorData.message}` 
        };
        setMessages(prev => [...prev, errorMsg]);
        setDailyUsage(errorData.usage);
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch from Oracle');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let assistantMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '' };
      setMessages(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') break;

            try {
              const data = JSON.parse(dataStr);
              if (data.type === 'text') {
                assistantMessage.content += data.content;
                setMessages(prev => [
                  ...prev.slice(0, -1),
                  { ...assistantMessage }
                ]);
              } else if (data.type === 'usage') {
                setDailyUsage(data.count);
              } else if (data.type === 'tool_call') {
                setStatus(`Executing ${data.toolCall.toolName}...`);
                await executeOracleTool(data.toolCall, store);
              }
            } catch (e) { }
          }
        }
      }

    } catch (error) {
      console.error('[Oracle] Error:', error);
    } finally {
      setIsLoading(false);
      setStatus('');
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
          <div className="md:hidden flex justify-center pt-4 pb-2" onClick={() => setChatOpen(false)}>
            <div className="w-12 h-1.5 bg-white/10 rounded-full" />
          </div>

          <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--accent)]/20 flex items-center justify-center border border-[var(--accent)]/50">
                <Bot className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white tracking-wide">Oracle AI</h3>
                  {plan === 'pro' && <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />}
                </div>
                <p className="text-[10px] text-[var(--accent)] font-mono uppercase tracking-wider">
                  {activeModel === 'openai/gpt-oss-120b' ? 'ORACLE-PRO 120B' : 'ORACLE-MINI 20B'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="px-2 py-1 rounded-lg bg-white/5 border border-white/5 mr-2">
                <p className="text-[10px] font-black uppercase tracking-tighter text-slate-500">
                  {plan === 'free' ? `${dailyUsage}/${limits.AI_DAILY_LIMIT} Daily` : 'Unlimited'}
                </p>
              </div>
              {messages.length > 0 && (
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
            {messages.length === 0 && (
              <div className="text-center text-slate-500 mt-10 md:mt-20">
                <Shield className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">Oracle Enabled</p>
                <p className="text-xs mt-2 opacity-60 px-10">I can help you organize your workspace.</p>
                {plan === 'free' && (
                  <div className="mt-6 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 mx-4">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 mb-1">Reduced AI Capabilities</p>
                    <p className="text-[9px] leading-relaxed">You have {limits.AI_DAILY_LIMIT} daily messages. Upgrade to Pro for premium <strong className="text-white">ORACLE-PRO 120B</strong> models and unlimited usage.</p>
                  </div>
                )}
              </div>
            )}
            
            {messages.map((msg) => {
              if (!msg.content?.trim() && msg.role === 'assistant') return null;
              return (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`
                      max-w-[90%] md:max-w-[85%] p-3 md:p-4 rounded-2xl text-sm leading-relaxed prose prose-invert
                      ${msg.role === 'user' 
                        ? 'bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-white rounded-tr-sm' 
                        : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-sm'}
                    `}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              );
            })}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />
                  <span className="text-xs text-slate-400">
                    {status || 'Oracle is thinking...'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <form 
            onSubmit={handleSubmit}
            className="p-4 pb-8 md:pb-4 border-t border-white/5 bg-black/20"
          >
            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={suggestion}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white outline-none focus:border-[var(--accent)]/50 resize-none h-14 custom-scroll md:h-14"
              />
              <button 
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 top-2 p-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent)]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatOverlay;
