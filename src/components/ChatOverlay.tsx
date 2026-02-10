import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { serializeWorkspace } from '../utils/contextBuilder';
import { X, Send, Shield, Loader2, Bot, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useChat } from 'ai/react';
import { DEFAULT_MODEL } from '../constants';

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

const ChatOverlay: React.FC = () => {
  const isChatOpen = useStore((state) => state.isChatOpen);
  const setChatOpen = useStore((state) => state.setChatOpen);
  const oracleMode = useStore((state) => state.oracleMode);
  const store = useStore();
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const suggestion = React.useMemo(() => 
    SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)], 
  [isChatOpen]);

  const { 
    messages, 
    input, 
    handleInputChange, 
    handleSubmit, 
    isLoading, 
    setMessages,
    status
  } = useChat({
    api: '/api/chat',
    body: {
      context: serializeWorkspace(
        store.activeSpaceId, 
        store.thoughts, 
        store.spaces, 
        store.stacks
      )
    },
    onToolCall: async ({ toolCall }) => {
      console.log(`[Oracle] Received Tool Call: ${toolCall.toolName}`, toolCall.args);
      
      // Only log tools handled on the client to reduce noise
      const clientTools = ['create_thought', 'link_thoughts', 'update_thought', 'delete_thoughts'];
      if (!clientTools.includes(toolCall.toolName)) {
        console.log(`[Oracle] Tool ${toolCall.toolName} is server-side, skipping frontend execution.`);
        return;
      }

      try {
        switch (toolCall.toolName) {
          case 'create_thought': {
            const { stackName, ...thoughtArgs } = toolCall.args as any;
            const x = typeof thoughtArgs.x !== 'undefined' ? Number(thoughtArgs.x) : window.innerWidth / 2;
            const y = typeof thoughtArgs.y !== 'undefined' ? Number(thoughtArgs.y) : window.innerHeight / 2;

            const id = await store.addThought({ ...thoughtArgs, x, y });
            if (stackName && id && id !== -1) await store.createStack(stackName, id);
            
            console.log(`[Oracle] Thought Created: ID ${id}`);
            return { success: true, id };
          }

          case 'link_thoughts': {
            const { ids, name } = toolCall.args as any;
            if (!ids?.length) return { success: false, error: 'No IDs provided' };
            store.setSelectedThoughtIds(ids);
            await store.linkSelectedThoughts(name);
            store.clearSelection();
            console.log(`[Oracle] Linked ${ids.length} thoughts into stack: ${name}`);
            return { success: true };
          }

          case 'update_thought': {
            const { id, stackName, ...updates } = toolCall.args as any;
            if (!id) return { success: false, error: 'Missing ID' };
            
            const sanitizedUpdates: any = { ...updates };
            if (typeof updates.x !== 'undefined') sanitizedUpdates.x = Number(updates.x);
            if (typeof updates.y !== 'undefined') sanitizedUpdates.y = Number(updates.y);

            await store.updateThought(id, sanitizedUpdates);
            if (stackName) await store.createStack(stackName, id);
            console.log(`[Oracle] Updated Thought: ID ${id}`);
            return { success: true };
          }

          case 'delete_thoughts': {
            const { ids } = toolCall.args as any;
            if (!ids?.length) return { success: false, error: 'No IDs provided' };
            await store.deleteThoughts(ids);
            console.log(`[Oracle] Deleted Thoughts: IDs ${ids.join(', ')}`);
            return { success: true };
          }
        }
      } catch (error) {
        console.error('[Oracle] Frontend Tool Execution Error:', error);
        return { success: false, error: 'Internal client tool error' };
      }
    },
    onResponse: (response) => {
      console.log('[Oracle] Stream Started - Status:', response.status);
    },
    onFinish: (message) => {
      console.log('[Oracle] Stream Finished - Final Message:', message.content);
    },
    onError: (err) => {
      console.error('[Oracle] Chat Error Context:', err);
    }
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isChatOpen, isLoading]);

  const handleClear = () => {
    setMessages([]);
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
                <h3 className="text-sm font-bold text-white tracking-wide">Oracle AI</h3>
                <p className="text-[10px] text-[var(--accent)] font-mono uppercase tracking-wider">{DEFAULT_MODEL}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
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
              </div>
            )}
            
            {messages.map((msg) => {
              if (!msg.content && msg.role === 'assistant') return null;
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
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              );
            })}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />
                  <span className="text-xs text-slate-400">
                    {status === 'submitted' ? 'Oracle is thinking...' : 'Oracle is processing...'}
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
                onChange={handleInputChange}
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
