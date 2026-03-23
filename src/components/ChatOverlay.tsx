import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { useModalStore } from '../store/useModalStore';
import { serializeWorkspace } from '../utils/contextBuilder';
import { X, Send, MessageSquare, Loader2, History, Square, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { PLAN_CONFIG, ORACLE_CONFIG, BASIC_MODELS, PREMIUM_MODELS } from '../constants';
import { executeOracleTool } from '../services/oracle/executor';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { db, type ChatMessage } from '../db';
import { ulid } from 'ulid';
import { AccessGuard } from './common/AccessGuard';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Message = ChatMessage;

// Build message content for follow-up - handle multimodal for images/PDFs
function getFollowUpMessageContent(toolName: string, result: any) {
  if (toolName === 'read_file_content' || toolName === 'read_files_content') {
    // Handle single file result
    if (result?.type === 'image' && result?.url) {
      return [
        { type: 'text', text: 'Analyze this image and describe what you see.' },
        { type: 'image', source: { type: 'url', url: result.url } }
      ];
    }
    if (result?.type === 'pdf' && result?.url) {
      return [
        { type: 'text', text: `Analyze the contents of this PDF: ${result.name || 'document'}` },
        { type: 'file', source: { type: 'url', url: result.url, media_type: 'application/pdf' }, title: result.name }
      ];
    }
    
    // Handle multiple files result
    if (result?.files && Array.isArray(result.files)) {
      const contents: any[] = [{ type: 'text', text: 'I have retrieved the contents of the requested files. Please analyze them:' }];
      
      result.files.forEach((f: any) => {
        if (f.success) {
          if (f.type === 'text') {
            contents.push({ type: 'text', text: `File Content (${f.id}):\n${f.content}` });
          } else if (f.type === 'pdf' && f.url) {
            contents.push({ 
              type: 'file', 
              source: { type: 'url', url: f.url, media_type: 'application/pdf' }, 
              title: f.name || `File ${f.id}` 
            });
          } else if (f.type === 'image' && f.url) {
            contents.push({ type: 'image', source: { type: 'url', url: f.url } });
          }
        }
      });
      return contents.length > 1 ? contents : 'Continue with the details I provided.';
    }
  }
  return 'Continue with the details I provided.';
}

const ChatOverlay: React.FC = () => {
  const isChatOpen = useStore((state) => state.isChatOpen);
  const setChatOpen = useStore((state) => state.setChatOpen);
  const oracleMode = useStore((state) => state.oracleMode);
  const store = useStore();
  const { user } = useAuthStore();
  const plan = user?.plan || 'free';
  const { openPricing } = useModalStore();
  const limits = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG];
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [activeTool, setActiveTool] = useState<{ name: string; args: any } | null>(null);
  const [dailyUsage, setDailyUsage] = useState(user?.usage?.ai_daily_count || 0);
  const [selectedModel, setSelectedModel] = useState(plan === 'pro' ? PREMIUM_MODELS[0].id : BASIC_MODELS[0].id);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableModels = plan === 'pro' ? PREMIUM_MODELS : BASIC_MODELS;
  const currentModelInfo = availableModels.find((m) => m.id === selectedModel) || availableModels[0];

  // Load history from Dexie when spaceId changes
  useEffect(() => {
    if (store.activeSpaceId) {
      db.chatHistory
        .where('spaceId')
        .equals(store.activeSpaceId)
        .sortBy('timestamp')
        .then(history => {
          setMessages(history as Message[]);
        })
        .catch(err => console.error("[Oracle] Failed to load chat history:", err));
    } else {
      setMessages([]);
    }
  }, [store.activeSpaceId]);

  const saveMessage = async (msg: Message) => {
    // Don't save system messages to database - they clutter history
    if (msg.msgType === 'system') return;
    
    try {
      await db.chatHistory.add(msg);
    } catch (err) {
      console.error("[Oracle] Failed to save message:", err);
    }
  };

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

  // Close dropdown on click outside
  useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
        setModelSearch('');
      }
    };
    if (showModelDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showModelDropdown]);

  // Switch to default model when plan changes
  useEffect(() => {
    const defaultModel = plan === 'pro' ? PREMIUM_MODELS[0].id : BASIC_MODELS[0].id;
    setSelectedModel(defaultModel);
  }, [plan]);

  const activeModel = selectedModel;

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
      const fetchUsage = async () => {
        try {
          const token = await authStore.getOrRefreshToken();
          if (!token) return;
          
          const res = await fetch('/api/chat', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (typeof data.count === 'number') setDailyUsage(data.count);
        } catch (err) {
          console.error("[Oracle] Failed to fetch initial usage:", err);
        }
      };
      fetchUsage();
    }
  }, [isChatOpen, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isChatOpen, isLoading]);

  const handleClear = async () => {
    if (store.activeSpaceId) {
      try {
        await db.chatHistory.where('spaceId').equals(store.activeSpaceId).delete();
        setMessages([]);
      } catch (err) {
        console.error("[Oracle] Failed to clear history:", err);
      }
    } else {
      setMessages([]);
    }
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
    if (!input.trim() || isLoading || !store.activeSpaceId) return;

    if (plan === 'free' && dailyUsage >= (limits.AI_DAILY_LIMIT || 0)) {
      const errorMsg: Message = { 
        id: ulid(),
        spaceId: store.activeSpaceId,
        role: 'assistant', 
        content: "### Limit Reached\nChoom, you've hit your daily data-stream limit for the Free tier. Upgrade to **Pro** for unlimited access and premium models!",
        timestamp: Date.now(),
        msgType: 'system'
      };
      setMessages(prev => [...prev, { 
        id: ulid(), 
        spaceId: store.activeSpaceId!, 
        role: 'user', 
        content: input,
        timestamp: Date.now() - 1,
        msgType: 'chat'
      }, errorMsg]);
      setInput('');
      return;
    }

    const userMessage: Message = { 
      id: ulid(), 
      spaceId: store.activeSpaceId, 
      role: 'user', 
      content: input,
      timestamp: Date.now(),
      msgType: 'chat'
    };
    
    setMessages(prev => [...prev, userMessage]);
    saveMessage(userMessage);
    
    setInput('');
    setIsLoading(true);
    setStatus('thinking');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const authStore = useAuthStore.getState();
      const token = await authStore.getOrRefreshToken();
      
      if (!token) {
        throw new Error('Unauthorized: Session expired');
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal,
        body: JSON.stringify({
// History Sliding Window: Filter out system messages to keep AI context clean
          messages: [...messages.filter(m => m.msgType !== 'system').slice(-ORACLE_CONFIG.HISTORY_WINDOW_SIZE), userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
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
          id: ulid(), 
          spaceId: store.activeSpaceId,
          role: 'assistant', 
          content: `### Connection Saturated\n${errorData.message}`,
          timestamp: Date.now(),
          msgType: 'system'
        };
        setMessages(prev => [...prev, errorMsg]);
        saveMessage(errorMsg);
        setDailyUsage(errorData.usage);
        return;
      }

      if (response.status === 401) {
        const errorMsg: Message = { 
          id: ulid(), 
          spaceId: store.activeSpaceId,
          role: 'assistant', 
          content: `### Connection Expired\nChoom, your session has timed out. Please sign in again to continue your data stream.`,
          timestamp: Date.now(),
          msgType: 'system'
        };
        setMessages(prev => [...prev, errorMsg]);
        saveMessage(errorMsg);
        useAuthStore.getState().signOut(); // Graceful cleanup
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch from Oracle');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let assistantMessage: Message = { 
        id: ulid(), 
        spaceId: store.activeSpaceId,
        role: 'assistant', 
        content: '',
        timestamp: Date.now(),
        msgType: 'chat'
      };
      
      setMessages(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Final save when stream is done
          if (assistantMessage.content.trim()) {
            saveMessage(assistantMessage);
          }
          break;
        }

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
                const errMsg: Message = { 
                  id: ulid(), 
                  spaceId: store.activeSpaceId,
                  role: 'assistant', 
                  content: `### Logic Snag\n${data.message}`,
                  timestamp: Date.now(),
                  msgType: 'system'
                };
                setMessages(prev => [
                  ...prev.slice(0, -1),
                  errMsg
                ]);
                saveMessage(errMsg);
              } else if (data.type === 'usage') {
                setDailyUsage(data.count);
} else if (data.type === 'tool_call') {
                setActiveTool({ name: data.toolCall.toolName, args: data.toolCall.args });
                setStatus(data.isBatch 
                  ? `Batch Creating ${data.batchCount} Thoughts...` 
                  : getFriendlyToolName(data.toolCall.toolName));
                
                try {
                  const result = await executeOracleTool(data.toolCall, store);
                  
                  // If there's an error in the result, display it
                  if (!result.success && result.error) {
                    const errResultMsg: Message = {
                      id: ulid(),
                      spaceId: store.activeSpaceId,
                      role: 'assistant',
                      content: `⚠️ ${result.error}`,
                      timestamp: Date.now(),
                      msgType: 'system'
                    };
                    setMessages(prev => [...prev, errResultMsg]);
                    saveMessage(errResultMsg);
                  }
                  
                  // DATA ROUND-TRIP: If the tool returned data (Retrieval), we need to send it back to Oracle
                  // We store retrieval results to send them all at once after the tool loop finishes if needed,
                  // but for now, we'll keep the immediate follow-up logic but make it more robust.
                  
if (['get_thought_details', 'read_file_content', 'read_files_content'].includes(data.toolCall.toolName) && result.success) {
                    // Optimized: Continue with minimal context to avoid re-sending full workspace
                    
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
                    const followUpToken = await authStore.getOrRefreshToken();
                    
                    if (!followUpToken) {
                      throw new Error('Unauthorized: Session expired');
                    }

                    const followUpResponse = await fetch('/api/chat', {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${followUpToken}`
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
                          if (done) {
                            if (assistantMessage.content.trim()) {
                               saveMessage(assistantMessage);
                            }
                            break;
                          }
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
                                  const toolResult = await executeOracleTool(fData.toolCall, store);
                                  // If there's an error in the result, display it
                                  if (!toolResult.success && toolResult.error) {
                                    const errRecMsg: Message = {
                                      id: ulid(),
                                      spaceId: store.activeSpaceId,
                                      role: 'assistant',
                                      content: `⚠️ ${toolResult.error}`,
                                      timestamp: Date.now(),
                                      msgType: 'system'
                                    };
                                    setMessages(prev => [...prev, errRecMsg]);
                                    saveMessage(errRecMsg);
                                  }
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

  // Oracle Chat disabled
  if (!oracleMode) return null;

  return (
    <AnimatePresence>
      {isChatOpen && (
        <motion.div
          id="chat-overlay"
          initial={{ x: '-100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '-100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 200 }}
          className="fixed top-4 md:top-24 bottom-4 md:bottom-24 left-4 md:left-8 w-[calc(100%-32px)] md:w-[500px] glass rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden z-[9999] border border-[var(--glass-border)]"
        >

          {/* HEADER - Updated Centering & Solid Dropdown */}
          <div className="px-4 py-3 md:px-5 border-b border-[var(--glass-border)] bg-[var(--bg-main)]/60 backdrop-blur-xl sticky top-0 z-30">
            <div className="flex justify-between items-start relative min-h-[44px]">
              
              {/* Left Placeholder for Flex Balance */}
              <div className="flex-1" />

              {/* Absolute Center - Perfectly aligned regardless of side actions */}
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center pointer-events-none mt-0.5 z-[60]">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)] animate-pulse" />
                  <h3 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--text-primary)] leading-none">Oracle AI</h3>
                </div>
                
                <div className="pointer-events-auto relative" ref={dropdownRef}>
                  <button
                    onClick={() => { setShowModelDropdown(!showModelDropdown); if (!showModelDropdown) setModelSearch(''); }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-[var(--glass-border)] transition-all group"
                  >
                    <span className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-widest leading-none mt-[1px]">
                      {currentModelInfo.name}
                    </span>
                    <ChevronDown className={cn("w-3 h-3 text-[var(--text-muted)] transition-transform", showModelDropdown && "rotate-180")} />
                  </button>

                  <AnimatePresence>
                    {showModelDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        /* CHANGED: Solid background with heavy shadow instead of transparent glass */
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-[var(--bg-main)] rounded-xl border border-[var(--glass-border)] shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-[100]"
                      >
                        <div className="p-2 border-b border-[var(--glass-border)]/50">
                          <input
                            type="text"
                            value={modelSearch}
                            onChange={(e) => setModelSearch(e.target.value)}
                            placeholder="Search models..."
                            className="w-full bg-[var(--bg-page)]/50 border border-[var(--glass-border)] rounded-lg px-3 py-2 text-[10px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] uppercase tracking-wider focus:outline-none focus:border-[var(--accent)]/50 transition-colors"
                            autoFocus
                          />
                        </div>
                        <div className="p-2 space-y-1">
                          {availableModels.filter(m => 
                            m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
                            m.desc.toLowerCase().includes(modelSearch.toLowerCase())
                          ).map((model) => (
                            <button
                              key={model.id}
                              onClick={() => {
                                setSelectedModel(model.id);
                                setShowModelDropdown(false);
                                setModelSearch('');
                              }}
                              className={cn(
                                "w-full flex items-center justify-center px-3 py-2 rounded-lg transition-all border",
                                selectedModel === model.id 
                                  ? "bg-[var(--accent)]/20 border-[var(--accent)]/30" 
                                  : "hover:bg-white/[0.05] border-transparent"
                              )}
                            >
                              <div className="flex flex-col items-center gap-1">
                                <span className={cn("text-[10px] font-bold uppercase tracking-widest leading-none mt-[1px]", selectedModel === model.id ? "text-[var(--accent)]" : "text-[var(--text-muted)]")}>
                                  {model.name}
                                </span>
                                <span className="text-[9px] font-medium text-[var(--text-muted)] opacity-80 uppercase tracking-wide leading-relaxed">
                                  {model.desc}
                                </span>
                              </div>
                              {selectedModel === model.id && (
                                <Check className="w-3 h-3 text-[var(--accent)] ml-2" />
                              )}
                            </button>
                          ))}
                        </div>
                        {plan === 'free' && (
                          <div className="p-2 border-t border-[var(--glass-border)]">
                            <button
                              onClick={() => {
                                setShowModelDropdown(false);
                                openPricing();
                              }}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/20 transition-all"
                            >
                              <span className="text-[9px] font-extrabold text-[var(--accent)] uppercase tracking-widest">
                                Upgrade to Pro
                              </span>
                              <span className="text-[8px] font-bold text-[var(--accent)]/60 uppercase tracking-wider">
                                +Models
                              </span>
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Right Actions */}
              <div className="flex-1 flex items-center justify-end gap-1 relative z-50">
                <button 
                  onClick={handleClear}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.08] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                  title="Clear Stream"
                >
                  <History className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setChatOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.08] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Messages Area */}

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scroll"
          >
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-14 h-14 bg-white/[0.03] rounded-2xl flex items-center justify-center mb-5 border border-[var(--glass-border)] shadow-inner">
                  <MessageSquare className="w-6 h-6 text-[var(--text-muted)]" />
                </div>
                <h4 className="text-[12px] font-extrabold uppercase tracking-[0.25em] text-[var(--text-primary)] mb-2">Welcome to Agentic Workspace</h4>
                <p className="text-[10px] font-medium text-[var(--text-muted)] max-w-[320px] leading-relaxed uppercase tracking-widest">
                  Ready to map your thoughts. Ask me to research, organize, or create.
                </p>
                {plan === 'free' && (
                  <button 
                    onClick={openPricing}
                    className="mt-8 p-4 rounded-xl bg-[var(--accent)]/5 border border-[var(--accent)]/20 mx-4 group/upgr transition-all hover:bg-[var(--accent)]/10 hover:border-[var(--accent)]/30 active:scale-[0.98]"
                  >
                    <p className="text-[11px] uppercase font-extrabold tracking-[0.2em] text-[var(--accent-secondary)] mb-2 group-hover/upgr:text-[var(--accent)]">Limited Capabilities</p>
                    <p className="text-[10px] font-medium text-[var(--text-muted)] leading-relaxed uppercase tracking-widest">
                      Upgrade to Pro for <strong className="text-[var(--accent-secondary)]">more</strong> usage and <strong className="text-[var(--accent-secondary)]">premium advanced</strong> reasoning models.
                    </p>
                  </button>
                )}
              </div>
            )}
            
            {messages.map((m) => {
              if (!m.content?.trim() && m.role === 'assistant') return null;
              return (
                <div key={m.id} className={cn(
                  "flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-500",
                  m.role === 'user' ? "items-end" : "items-start"
                )}>
                  <div className={cn(
                    "max-w-[92%] p-3.5 px-4 rounded-2xl text-[12px] leading-relaxed border shadow-sm prose prose-invert prose-xs break-words overflow-hidden",
                    m.role === 'user' 
                      ? "bg-[var(--accent)]/20 text-[var(--text-primary)] border-[var(--accent)]/30 rounded-tr-sm" 
                      : "bg-[var(--bg-page)]/20 text-[var(--text-primary)] border-[var(--glass-border)] rounded-tl-sm"
                  )}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{m.content}</ReactMarkdown>
                  </div>
                  <span className="text-[8px] font-bold uppercase tracking-widest text-[var(--text-muted)] px-1">
                    {m.role === 'user' ? 'You' : 'Oracle'}
                  </span>
                </div>
              );
            })}
            
            {isLoading && (
              <div className="flex flex-col gap-2 items-start animate-pulse">
                {activeTool ? (
                  <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-4 py-2 rounded-xl flex items-center gap-3 shadow-[0_0_20px_var(--accent-glow)]">
                    <Loader2 className="w-3.5 h-3.5 text-[var(--accent)] animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">
                      {getFriendlyToolName(activeTool!.name)}
                    </span>
                  </div>
                ) : (
                  <div className="bg-[var(--bg-page)]/20 border border-[var(--glass-border)] p-3.5 px-4 rounded-2xl rounded-tl-sm flex items-center gap-3">
                    <div className="flex gap-1 items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-[var(--accent)]/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-[var(--accent)]/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-[var(--accent)]/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] ml-1">
                      {status || 'Oracle is thinking...'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Area */}
          <div className="p-4 md:p-5 bg-[var(--bg-main)]/60 backdrop-blur-md border-t border-[var(--glass-border)] space-y-3">
            <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-[var(--bg-page)]/20 border border-[var(--glass-border)] rounded-xl p-1.5 focus-within:border-[var(--accent)]/40 focus-within:bg-[var(--bg-page)]/30 transition-all shadow-inner">

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
                placeholder={store.oracleChatMode === 'chat' ? "Message Oracle..." : "Command Oracle..."}
                rows={1}
                className="flex-1 bg-transparent border-none py-2.5 pl-3 pr-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none resize-none min-h-[36px] max-h-32 custom-scroll leading-relaxed"
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-all shadow-lg active:scale-95 group/cancel mb-0.5"
                  title="Cancel Stream"
                >
                  <Square className="w-3.5 h-3.5 fill-current group-hover:scale-110 transition-transform" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-[var(--accent)]/90 hover:bg-[var(--accent)] disabled:bg-white/5 disabled:text-[var(--text-muted)] text-[var(--bg-main)] rounded-lg transition-all shadow-lg active:scale-95 mb-0.5"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            {/* Mode Toggle - Pill Style */}
            <div className="flex items-center justify-between gap-2 px-1 pb-1">
              <div className="flex items-center h-8 bg-white/[0.02] rounded-lg p-1 border border-[var(--glass-border)]">
                <button
                  onClick={() => store.setOracleChatMode('chat')}
                  className={cn(
                    "px-3 h-6 rounded-md transition-all duration-300 flex items-center gap-1.5",
                    store.oracleChatMode === 'chat' 
                      ? "bg-[var(--accent)]/20 text-[var(--accent-secondary)] shadow-[0_0_10px_var(--accent-glow)]" 
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.03]"
                  )}
                >
                  <div className={cn("w-1.5 h-1.5 rounded-full transition-all", store.oracleChatMode === 'chat' ? "bg-[var(--accent)] shadow-[0_0_6px_var(--accent-glow)]" : "bg-white/10")} />
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] mt-[1px]">Chat</span>
                </button>
                <div className="w-[1px] h-3 bg-white/10 mx-1"></div>
                <AccessGuard 
                  user={user} 
                  mode="disable" 
                  feature="pro"
                >
                  <button
                    onClick={() => store.setOracleChatMode('action')}
                    className={cn(
                      "px-3 h-6 rounded-md transition-all duration-300 flex items-center gap-1.5",
                      store.oracleChatMode === 'action' 
                        ? "bg-[var(--status-doing)]/20 text-[var(--status-doing)] shadow-[0_0_10px_rgba(234,179,8,0.15)]" 
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.03]"
                    )}
                  >
                    <div className={cn("w-1.5 h-1.5 rounded-full transition-all", store.oracleChatMode === 'action' ? "bg-[var(--status-doing)] shadow-[0_0_6px_rgba(234,179,8,0.6)]" : "bg-white/10")} />
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] mt-[1px]">Action</span>
                  </button>
                </AccessGuard>
              </div>
              <span className="text-[9px] font-medium text-[var(--text-muted)] uppercase tracking-wider leading-tight max-w-[160px] text-right">
                Oracle AI is in development errors may occur
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatOverlay;