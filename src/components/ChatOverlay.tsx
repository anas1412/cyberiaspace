import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { serializeWorkspace } from '../utils/contextBuilder';
import { X, Send, Shield, Loader2, Bot, History, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { PLAN_CONFIG } from '../constants';
import { executeOracleTool } from '../services/oracle/executor';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
        content: "### Limit Reached\nChoom, you've hit your daily data-stream limit for the Free tier. Upgrade to **Pro** for unlimited access and premium models!" 
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
          // History Sliding Window: Only send last 10 messages
          messages: [...messages.slice(-10), userMessage],
          model: activeModel,
          plan: plan,
          context: serializeWorkspace(
            store.activeSpaceId, 
            store.thoughts, 
            store.spaces, 
            store.stacks,
            store.selectedThoughtIds
          )
        }),
      });

      if (response.status === 429) {
        const errorData = await response.json();
        const errorMsg: Message = { 
          id: Date.now().toString(), 
          role: 'assistant', 
          content: `### Connection Saturated\n${errorData.message}` 
        };
        setMessages(prev => [...prev, errorMsg]);
        setDailyUsage(errorData.usage);
        return;
      }

      if (response.status === 401) {
        const errorMsg: Message = { 
          id: Date.now().toString(), 
          role: 'assistant', 
          content: `### Connection Expired\nChoom, your session has timed out. Please sign in again to continue your data stream.\n\n<button onclick="window._cyberia_reauth()" class="px-4 py-2 bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all mt-2">Refresh Session</button>` 
        };
        setMessages(prev => [...prev, errorMsg]);
        useAuthStore.getState().signOut(); // Graceful cleanup
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
              } else if (data.type === 'error') {
                setMessages(prev => [
                  ...prev.slice(0, -1),
                  { id: Date.now().toString(), role: 'assistant', content: `### Logic Snag\n${data.message}` }
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
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 200 }}
          className="fixed top-4 md:top-24 bottom-4 md:bottom-24 right-4 w-[calc(100%-32px)] md:w-[520px] glass md:rounded-[2rem] shadow-[0_0_80px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden z-[9999] border border-white/10"
        >
          {/* Header */}
          <div className="p-4 md:p-5 border-b border-white/5 flex items-center justify-between bg-black/20 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.15)] relative overflow-hidden group">
                <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />
                <Bot className="w-5 h-5 text-indigo-400 relative z-10" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white leading-none">Oracle</h3>
                  {plan === 'pro' && <Zap className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-1 h-1 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                    {activeModel === 'openai/gpt-oss-120b' ? 'PRO 120B ACTIVE' : 'MINI 20B ACTIVE'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={handleClear}
                className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-all group"
                title="Clear Stream"
              >
                <History className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              </button>
              <button 
                onClick={() => setChatOpen(false)}
                className="p-2 hover:bg-red-500/10 rounded-lg text-slate-500 hover:text-red-400 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scroll"
          >
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-12">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 border border-white/5">
                  <Shield className="w-6 h-6 text-slate-400" />
                </div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white mb-1.5">Workspace Intelligence Active</h4>
                <p className="text-[9px] font-bold text-slate-500 max-w-[180px] leading-relaxed uppercase tracking-widest">
                  Ready to map your thoughts. Ask me to research, organize, or create.
                </p>
                {plan === 'free' && (
                  <div className="mt-6 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 mx-4">
                    <p className="text-[9px] uppercase font-black tracking-[0.2em] text-indigo-400 mb-1.5">Limited Capabilities</p>
                    <p className="text-[8px] font-bold text-slate-500 leading-relaxed uppercase tracking-widest">
                      Upgrade to Pro for <strong className="text-indigo-300">Unlimited</strong> usage and <strong className="text-indigo-300">120B</strong> reasoning models.
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {messages.map((m) => {
              if (!m.content?.trim() && m.role === 'assistant') return null;
              return (
                <div key={m.id} className={cn(
                  "flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500",
                  m.role === 'user' ? "items-end" : "items-start"
                )}>
                  <div className={cn(
                    "max-w-[95%] p-4 rounded-2xl text-[12px] leading-relaxed border shadow-sm prose prose-invert prose-xs",
                    m.role === 'user' 
                      ? "bg-indigo-500/20 text-white border-indigo-400/30 rounded-tr-sm" 
                      : "bg-white/[0.03] text-slate-200 border-white/5 rounded-tl-sm"
                  )}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{m.content}</ReactMarkdown>
                  </div>
                  <span className="text-[7px] font-black uppercase tracking-widest text-slate-600 px-1">
                    {m.role === 'user' ? 'You' : 'Oracle'}
                  </span>
                </div>
              );
            })}
            
            {isLoading && (
              <div className="flex flex-col gap-2 items-start animate-pulse">
                <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl rounded-tl-sm flex items-center gap-2.5">
                  <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {status || 'Oracle is thinking...'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Area */}
          <div className="p-4 md:p-6 bg-black/40 border-t border-white/5 space-y-3">
            {plan === 'free' && (
              <div className="px-1">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[7px] font-black uppercase tracking-widest text-slate-500">Daily Stream Usage</span>
                  <span className="text-[7px] font-black text-indigo-400">{dailyUsage} / {limits.AI_DAILY_LIMIT}</span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(dailyUsage / (limits.AI_DAILY_LIMIT || 1)) * 100}%` }}
                    className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                  />
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="relative group">
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
                disabled={isLoading}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-4 pr-12 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all disabled:opacity-50 resize-none h-14 custom-scroll"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 top-2 bottom-2 w-9 flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg transition-all shadow-lg active:scale-95"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatOverlay;
