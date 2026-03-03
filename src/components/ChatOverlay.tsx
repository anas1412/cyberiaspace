import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { serializeWorkspace } from '../utils/contextBuilder';
import { X, Send, Shield, Loader2, History, Zap, Square } from 'lucide-react';
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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_SUGGESTIONS = [
  "Summarize my recent thoughts...",
  "Research the history of Cyberpunk...",
  "Brainstorm 5 features for a new app...",
  "Analyze the files in this space...",
  "Find me the top 3 lo-fi tracks..."
];

const ACTION_SUGGESTIONS = [
  "Create a task list for my project...",
  "Build a table for my expenses...",
  "Link all my urgent tasks together...",
  "Clear all the thoughts in this space...",
  "Group all my notes about AI...",
  "Add 3 inspirational quotes about tech..."
];

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
  const [activeTool, setActiveTool] = useState<{ name: string; args: any } | null>(null);
  const [dailyUsage, setDailyUsage] = useState(user?.usage?.ai_daily_count || 0);

  const suggestion = useMemo(() => {
    const list = store.oracleChatMode === 'chat' ? CHAT_SUGGESTIONS : ACTION_SUGGESTIONS;
    return list[Math.floor(Math.random() * list.length)];
  }, [store.oracleChatMode, isChatOpen]);


  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-focus logic
  useEffect(() => {
    if (isChatOpen && !isLoading) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isChatOpen, isLoading]);

  // Dynamic Textarea Height logic
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 128)}px`;
    }
  }, [input]);

  // Strict plan-based model selection
  const activeModel = plan === 'pro' ? 'premium models' : 'free models';

  const getFriendlyToolName = (name: string) => {
    switch (name) {
      case 'get_thought_details': return 'Reading Workspace Data...';
      case 'create_thought': return 'Creating New Thought...';
      case 'create_thoughts': return 'Bulk Creating Thoughts...';
      case 'update_thought': return 'Updating Thought...';
      case 'update_thoughts': return 'Bulk Updating Thoughts...';
      case 'update_stack': return 'Renaming Stack...';
      case 'update_stacks': return 'Renaming Stacks...';
      case 'delete_stack': return 'Deleting Stack...';
      case 'delete_stacks': return 'Deleting Stacks...';
      case 'read_file_content': return 'Reading File...';
      case 'read_files_content': return 'Reading Files...';
      case 'web_search': return 'Researching Online...';
      case 'search_youtube': return 'Searching YouTube...';
      case 'delete_thoughts': return 'Clearing Thoughts...';
      case 'create_stack': return 'Organizing Stack...';
      case 'link_thoughts': return 'Linking Thoughts...';
      case 'unlink_thoughts': return 'Unlinking Thoughts...';
      default: return 'Working...';
    }
  };

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

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setStatus('');
    }
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

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const authStore = useAuthStore.getState();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.accessToken}`
        },
        signal: controller.signal,
        body: JSON.stringify({
// History Sliding Window: Only send last 5 messages
          messages: [...messages.slice(-5), userMessage],
          model: activeModel,
          plan: plan,
          mode: store.oracleChatMode,
          context: serializeWorkspace(
            store.activeSpaceId, 
            store.thoughts, 
            store.spaces, 
            store.stacks,
            store.selectedThoughtIds,
            user
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
          content: `### Connection Expired\nChoom, your session has timed out. Please sign in again to continue your data stream.\n\n<button onclick="window._cyberia_reauth()" class="px-4 py-2 bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all mt-2">Refresh Session</button>` 
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
                setActiveTool({ name: data.toolCall.toolName, args: data.toolCall.args });
                setStatus(data.isBatch 
                  ? `Batch Creating ${data.batchCount} Thoughts...` 
                  : getFriendlyToolName(data.toolCall.toolName));
                
                try {
                  const result = await executeOracleTool(data.toolCall, store);
                  
                  // DATA ROUND-TRIP: If the tool returned data (Retrieval), we need to send it back to Oracle
                  // We store retrieval results to send them all at once after the tool loop finishes if needed,
                  // but for now, we'll keep the immediate follow-up logic but make it more robust.
                  
if (['get_thought_details', 'read_file_content'].includes(data.toolCall.toolName) && result.success) {
                    // Optimized: Continue with minimal context to avoid re-sending full workspace
                    
// Build message content for follow-up - handle multimodal for images/PDFs
function getFollowUpMessageContent(toolName: string, result: any) {
  if (toolName === 'read_file_content' || toolName === 'read_files_content') {
    if (result?.type === 'image' && result?.url) {
      return [
        { type: 'text', text: 'Analyze this image and describe what you see.' },
        { type: 'image_url', image_url: { url: result.url } }
      ];
    }
    if (result?.type === 'pdf' && result?.url) {
      return [
        { type: 'text', text: `Analyze the contents of this PDF: ${result.name || 'document'}` },
        { type: 'document', source: { type: 'url', url: result.url, media_type: 'application/pdf' }, title: result.name }
      ];
    }
  }
  return 'Continue with the details I provided.';
}

const minimalContext = JSON.stringify({
                      currentTime: {
                        date: new Date().toLocaleDateString('en-CA'),
                        full: new Date().toLocaleString(),
                        day: new Date().toLocaleDateString('en-US', { weekday: 'long' })
                      },
                      userQuota: user ? {
                        plan: user.plan,
                        aiDailyUsed: user.usage?.ai_daily_count,
                      } : undefined,
                      currentSpace: {
                        id: store.activeSpaceId,
                        name: store.spaces.find((s: any) => s.id === store.activeSpaceId)?.name || 'Unknown'
                      }
                    });

                    const authStore = useAuthStore.getState();
                    const followUpResponse = await fetch('/api/chat', {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authStore.accessToken}`
                      },
                      signal: controller.signal,
                      body: JSON.stringify({
                        messages: [
                          { role: 'user', content: getFollowUpMessageContent(data.toolCall.toolName, result) },
                          { role: 'tool', tool_call_id: data.toolCall.id, name: data.toolCall.toolName, content: JSON.stringify(result) }
                        ],
                        model: activeModel,
                        plan: plan,
                        mode: store.oracleChatMode,
                        context: minimalContext
                      }),
                    });
                    
                    if (followUpResponse.ok) {
                      const followUpReader = followUpResponse.body?.getReader();
                      if (followUpReader) {
                        const followUpDecoder = new TextDecoder();
                        while (true) {
                          const { done, value } = await followUpReader.read();
                          if (done) break;
                          const followUpChunk = followUpDecoder.decode(value, { stream: true });
                          const followUpLines = followUpChunk.split('\n');
                          for (const fLine of followUpLines) {
                            if (fLine.startsWith('data: ')) {
                              const fDataStr = fLine.slice(6);
                              if (fDataStr === '[DONE]') break;
                              try {
                                const fData = JSON.parse(fDataStr);
                                if (fData.type === 'text') {
                                  assistantMessage.content += fData.content;
                                  setMessages(prev => [...prev.slice(0, -1), { ...assistantMessage }]);
                                } else if (fData.type === 'tool_call') {
                                  // RECURSION: If Oracle calls ANOTHER tool after reading (like create_thought)
                                  // We handle it by calling this same logic recursively or triggering a secondary execution
                                  setActiveTool({ name: fData.toolCall.toolName, args: fData.toolCall.args });
                                  setStatus(getFriendlyToolName(fData.toolCall.toolName));
                                  await executeOracleTool(fData.toolCall, store);
                                }
                              } catch (e) {}
                            }
                          }
                        }
                      }
                    }
                  }
                } finally {
                  setActiveTool(null);
                }
              }
            } catch (e) { }
          }
        }
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[Oracle] Stream aborted by user');
      } else {
        console.error('[Oracle] Error:', error);
      }
    } finally {
      setIsLoading(false);
      setStatus('');
      abortControllerRef.current = null;
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
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white leading-none">Oracle</h3>
                  {plan === 'pro' && <Zap className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-1 h-1 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                    {activeModel}
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

          {/* AI Usage Progress Bar */}
          {user && (
            <div className="px-5 py-2 bg-black/10 border-b border-white/5">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[7px] font-black uppercase tracking-widest text-slate-500">Daily Quota</span>
                <span className="text-[7px] font-black text-blue-400">
                  {dailyUsage} / {limits.AI_DAILY_LIMIT}
                </span>
              </div>
              <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (dailyUsage / (limits.AI_DAILY_LIMIT || 1)) * 100)}%` }}
                  className="h-full bg-blue-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]" 
                />
              </div>
            </div>
          )}

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
                  <div className="mt-6 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 mx-4">
                    <p className="text-[9px] uppercase font-black tracking-[0.2em] text-blue-400 mb-1.5">Limited Capabilities</p>
                    <p className="text-[8px] font-bold text-slate-500 leading-relaxed uppercase tracking-widest">
                      Upgrade to Pro for <strong className="text-blue-300">Unlimited</strong> usage and <strong className="text-blue-300">120B</strong> reasoning models.
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
                    "max-w-[95%] p-4 rounded-2xl text-[12px] leading-relaxed border shadow-sm prose prose-invert prose-xs break-words overflow-hidden",
                    m.role === 'user' 
                      ? "bg-blue-500/20 text-white border-blue-400/30 rounded-tr-sm" 
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
                {activeTool ? (
                  <div className="bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl flex items-center gap-3 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                    <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">
                      {getFriendlyToolName(activeTool.name)}
                    </span>
                  </div>
                ) : (
                  <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl rounded-tl-sm flex items-center gap-2.5">
                    <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {status || 'Oracle is thinking...'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Area */}
          <div className="p-4 md:p-6 bg-black/40 border-t border-white/5 space-y-3">
            <form onSubmit={handleSubmit} className="relative flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-2xl p-1.5 focus-within:border-blue-500/50 focus-within:bg-white/[0.05] transition-all">

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!isLoading) e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={(store.oracleChatMode === 'chat' ? "Inquiry: " : "Command: ") + suggestion}
                rows={1}
                className="flex-1 bg-transparent border-none py-2.5 pl-3 pr-2 text-xs text-white placeholder:text-slate-600 focus:outline-none resize-none min-h-[36px] max-h-32 custom-scroll leading-relaxed"
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all shadow-lg active:scale-95 group/cancel"
                  title="Cancel Stream"
                >
                  <Square className="w-3 h-3 fill-current group-hover:scale-110 transition-transform" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:bg-slate-800/50 disabled:text-slate-600 text-white rounded-xl transition-all shadow-lg active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            {/* Mode Toggle */}
            <div className="flex items-center justify-center gap-6 pb-2">
              <button
                onClick={() => store.setOracleChatMode('chat')}
                className={cn(
                  "text-[9px] font-black uppercase tracking-[0.2em] transition-all",
                  store.oracleChatMode === 'chat' ? "text-blue-400" : "text-slate-600 hover:text-slate-400"
                )}
              >
                Chat
              </button>
              <button
                onClick={() => store.setOracleChatMode('action')}
                className={cn(
                  "text-[9px] font-black uppercase tracking-[0.2em] transition-all",
                  store.oracleChatMode === 'action' ? "text-amber-400" : "text-slate-600 hover:text-slate-400"
                )}
              >
                Action
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatOverlay;
