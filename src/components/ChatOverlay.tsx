import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { serializeWorkspace } from '../utils/contextBuilder';
import { 
  resolveAllReferences, 
  filterThoughts, 
  filterStacks, 
  type SuggestionItem 
} from '../utils/referenceParser';
import SuggestionDropdown from './SuggestionDropdown';
import { X, SendHorizonal, MessageSquare, Loader2, Square, ChevronDown, ChevronLeft, Pencil, Trash2, Check, X as XIcon, Copy, Key, Eye, EyeOff, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { ORACLE_CONFIG } from '../constants';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { db, type ChatMessage } from '../db';
import { ulid } from 'ulid';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Message = ChatMessage;

// BYOK API key management
const API_KEY_STORAGE_KEY = 'cyberia-openrouter-key';

const getStoredApiKey = (): string => {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch { return ''; }
};

const setStoredApiKey = (key: string) => {
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
  } catch { /* noop */ }
};

// Common free/cheap OpenRouter models
/** Minimal fallback in case the models JSON fails to load */
const FALLBACK_MODELS: ModelOption[] = [
  { id: 'openai/gpt-5.5', name: 'GPT 5.5', desc: 'OpenAI flagship' },
];

export type ModelOption = { id: string; name: string; desc: string };

/** Convert ChatOverlay messages to OpenRouter-compatible format */
function toOpenRouterMessages(messages: Message[]) {
  return messages.map(m => ({
    role: m.role,
    content: m.content
  }));
}

const ChatOverlay: React.FC = () => {
  const isChatOpen = useStore((state) => state.isChatOpen);
  const setChatOpen = useStore((state) => state.setChatOpen);
  const store = useStore();

  // BYOK state
  const [apiKey, setApiKey] = useState(getStoredApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [editingApiKey, setEditingApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(apiKey);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [activeTool] = useState<{ name: string; args: any } | null>(null);

  // Simple model selection (no tiers/plans)
  const [availableModels, setAvailableModels] = useState<ModelOption[]>(FALLBACK_MODELS);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [selectedModel, setSelectedModel] = useState(
    () => localStorage.getItem('cyberia-ai-model') || ''
  );
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  // Reset search when dropdown closes
  useEffect(() => {
    if (!showModelDropdown) setModelSearch('');
  }, [showModelDropdown]);

  // Fetch models from JSON at runtime — override URL via localStorage key 'cyberia-models-url'
  useEffect(() => {
    const url = localStorage.getItem('cyberia-models-url') || '/available-models.json';
    fetch(url)
      .then(r => r.json())
      .then((data: ModelOption[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setAvailableModels(data);
        }
      })
      .catch(err => console.error('[AI] Failed to load models:', err))
      .finally(() => setModelsLoaded(true));
  }, []);

  // Set default model once loaded if nothing saved
  useEffect(() => {
    if (modelsLoaded && availableModels.length > 0 && !selectedModel) {
      setSelectedModel(availableModels[0].id);
    }
  }, [modelsLoaded, availableModels, selectedModel]);

  // Edit/delete state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleCopyMessage = async (msg: Message) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedMessageId(msg.id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('[AI] Failed to copy message:', err);
    }
  };

  // Suggestion dropdown state for @thought and #stack references
  const [suggestions, setSuggestions] = useState<{
    isOpen: boolean;
    type: 'thought' | 'stack';
    query: string;
    position: { top: number; left: number };
    items: SuggestionItem[];
    selectedIndex: number;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search when dropdown opens
  useEffect(() => {
    if (showModelDropdown) {
      // Small delay to let the animation start
      const t = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [showModelDropdown]);

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
        .catch(err => console.error("[AI] Failed to load chat history:", err));
    } else {
      setMessages([]);
    }
  }, [store.activeSpaceId]);

  // Save API key on change
  useEffect(() => {
    if (apiKey) setStoredApiKey(apiKey);
  }, [apiKey]);

  // Save selected model
  useEffect(() => {
    localStorage.setItem('cyberia-ai-model', selectedModel);
  }, [selectedModel]);

  const saveMessage = async (msg: Message) => {
    if (msg.msgType === 'system') return;
    try {
      await db.chatHistory.put(msg);
    } catch (err) {
      console.error("[AI] Failed to save message:", err);
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
      }
    };
    if (showModelDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showModelDropdown]);

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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isChatOpen, isLoading]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setStatus('');
    }
  };

  /** Call OpenRouter API directly from browser */
  const callOpenRouter = async (
    messages: any[],
    model: string,
    signal: AbortSignal,
    onChunk: (text: string) => void
  ) => {
    if (!apiKey) throw new Error('No API key configured');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Cyberia'
      },
      signal,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      let errMsg = `OpenRouter API error (${response.status})`;
      try {
        const errJson = JSON.parse(errBody);
        errMsg = errJson.error?.message || errMsg;
      } catch { /* ignore parse errors */ }
      throw new Error(errMsg);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response stream');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') continue;

        try {
          const data = JSON.parse(dataStr);
          const choice = data.choices?.[0];

          if (choice?.delta?.content) {
            onChunk(choice.delta.content);
          }

          if (choice?.delta?.tool_calls) {
            // Not handling tool calls via streaming format - using response-level instead
          }

          if (choice?.finish_reason) {
            // Stream complete
          }
        } catch { /* skip malformed */ }
      }
    }
  };

  // Handle input changes and show suggestion dropdown for @thought/#stack references
  const handleInputChange = (value: string, textarea: HTMLTextAreaElement) => {
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    
    const atMatch = textBeforeCursor.match(/@(.*)$/);
    const hashMatch = textBeforeCursor.match(/#(.*)$/);
    
    if (atMatch) {
      const query = atMatch[1];
      const filtered = filterThoughts(store.thoughts, query, 5);
      
      if (filtered.length > 0) {
        setSuggestions({
          isOpen: true,
          type: 'thought',
          query,
          position: { top: 0, left: 0 },
          items: filtered,
          selectedIndex: 0
        });
        return;
      }
    }
    
    if (hashMatch) {
      const query = hashMatch[1];
      const filtered = filterStacks(store.stacks, query, 5);
      
      if (filtered.length > 0) {
        setSuggestions({
          isOpen: true,
          type: 'stack',
          query,
          position: { top: 0, left: 0 },
          items: filtered,
          selectedIndex: 0
        });
        return;
      }
    }
    
    setSuggestions(null);
  };

  // Insert selected suggestion into input
  const insertSuggestion = (item: SuggestionItem) => {
    if (!inputRef.current) return;
    
    const cursorPos = inputRef.current.selectionStart;
    const textBeforeCursor = input.substring(0, cursorPos);
    const textAfterCursor = input.substring(cursorPos);
    
    const triggerMatch = textBeforeCursor.match(/([@#])\S*$/);
    const trigger = triggerMatch ? triggerMatch[1] : (item.type === 'thought' ? '@' : '#');
    
    const newTextBefore = textBeforeCursor.replace(/[@#]\S*$/, `${trigger}${item.name} `);
    
    setInput(newTextBefore + textAfterCursor);
    setSuggestions(null);
    
    setTimeout(() => {
      inputRef.current?.focus();
      const newPos = newTextBefore.length;
      inputRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Handle keyboard navigation in suggestions
  const handleSuggestionKeyDown = (e: React.KeyboardEvent) => {
    if (!suggestions) return;
    
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggestions(s => s ? { ...s, selectedIndex: Math.max(0, s.selectedIndex - 1) } : s);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggestions(s => s ? { ...s, selectedIndex: Math.min(s.items.length - 1, s.selectedIndex + 1) } : s);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = suggestions.items[suggestions.selectedIndex];
      insertSuggestion(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSuggestions(null);
    }
  };

  // Delete a message by ID
  const handleDeleteMessage = async (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
    try {
      await db.chatHistory.where('id').equals(id).delete();
    } catch (err) {
      console.error("[AI] Failed to delete message:", err);
    }
  };

  // Start editing a user message
  const handleStartEdit = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditInput(msg.content);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditInput('');
  };

  // Save edit - truncate messages after edited one and re-run
  const handleSaveEdit = async (msg: Message) => {
    if (!editInput.trim() || !store.activeSpaceId) return;
    
    const msgIndex = messages.findIndex(m => m.id === msg.id);
    if (msgIndex === -1) return;

    const truncatedMessages = messages.slice(0, msgIndex);

    const updatedMsg: Message = { ...msg, content: editInput };
    try {
      await db.chatHistory.put(updatedMsg);
      const messagesToDelete = messages.slice(msgIndex + 1);
      for (const m of messagesToDelete) {
        await db.chatHistory.where('id').equals(m.id).delete();
      }
    } catch (err) {
      console.error("[AI] Failed to update message:", err);
    }

    setMessages([...truncatedMessages, updatedMsg]);
    setEditingMessageId(null);
    setEditInput('');

    // Re-run AI with the edited content
    setIsLoading(true);
    setStatus('thinking');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let assistantContent = '';
    const assistantMsg: Message = {
      id: ulid(),
      spaceId: store.activeSpaceId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      msgType: 'chat'
    };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const apiMessages = toOpenRouterMessages(
        [...truncatedMessages, updatedMsg].filter(m => m.msgType !== 'system').slice(-ORACLE_CONFIG.HISTORY_WINDOW_SIZE)
      );

      await callOpenRouter(apiMessages, selectedModel, controller.signal, (chunk) => {
        assistantContent += chunk;
        assistantMsg.content = assistantContent;
        setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: assistantContent } : m));
      });

      if (assistantContent.trim()) {
        saveMessage(assistantMsg);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[AI] Error:', err);
        const errorMsg: Message = {
          id: ulid(),
          spaceId: store.activeSpaceId,
          role: 'assistant',
          content: `⚠️ **Error:** ${err.message || 'Unknown error occurred'}`,
          timestamp: Date.now(),
          msgType: 'system'
        };
        setMessages(prev => [...prev, errorMsg]);
        saveMessage(errorMsg);
      }
    } finally {
      setIsLoading(false);
      setStatus('');
      abortControllerRef.current = null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !store.activeSpaceId) return;

    // Check API key
    if (!apiKey) {
      setEditingApiKey(true);
      return;
    }

    // Close suggestions if open
    setSuggestions(null);

    // Resolve references to content (async)
    let messageContent: string | unknown[];
    let resolvedReferences: { references: { type: string; name: string; data: unknown[] }[]; userMessage: string };
    
    try {
      resolvedReferences = await resolveAllReferences(input, store.thoughts, store.stacks);
    } catch (err) {
      console.error("[AI] Failed to resolve references:", err);
      resolvedReferences = { references: [], userMessage: input };
    }
    
    if (resolvedReferences.references.length === 0) {
      messageContent = input;
    } else {
      const contentBlocks: unknown[] = [];
      for (const ref of resolvedReferences.references) {
        contentBlocks.push(...ref.data);
      }
      contentBlocks.push({ type: 'text', text: `User question: ${resolvedReferences.userMessage}` });
      messageContent = contentBlocks;
    }

    const contentForUI = input;

    const userMessage: Message = { 
      id: ulid(), 
      spaceId: store.activeSpaceId, 
      role: 'user', 
      content: contentForUI,
      timestamp: Date.now(),
      msgType: 'chat'
    };
    
    const apiContent = typeof messageContent === 'string' ? messageContent : messageContent;
    
    setMessages(prev => [...prev, userMessage]);
    saveMessage(userMessage);
    
    setInput('');
    setIsLoading(true);
    setStatus('thinking');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Build context for the AI
    const contextString = resolvedReferences.references.length === 0 
      ? serializeWorkspace(
          store.activeSpaceId, 
          store.thoughts, 
          store.spaces, 
          store.stacks,
          store.selectedThoughtIds,
          { id: 'guest', plan: 'free' }
        )
      : null;

    // Build system prompt
    const systemPrompt = store.aiChatMode === 'action'
      ? `You are Cyberia AI in ACTION mode. You have tools to create, read, update, and delete thoughts and stacks. The user can tag thoughts with @name and stacks with #name. Current time: ${new Date().toLocaleString()}. Workspace context: ${contextString || 'Provided via references'}. Use tools to fulfill the user's request.`

      : `You are Cyberia AI in CHAT mode (read-only). The user can tag thoughts with @name and stacks with #name. Current time: ${new Date().toLocaleString()}. Workspace context: ${contextString || 'Provided via references'}. You can read thoughts but CANNOT modify them.`;
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...toOpenRouterMessages(
        messages.filter(m => m.msgType !== 'system').slice(-ORACLE_CONFIG.HISTORY_WINDOW_SIZE)
      ),
      { 
        role: 'user', 
        content: resolvedReferences.references.length > 0 ? apiContent : input 
      }
    ];

    let assistantContent = '';
    const assistantMsg: Message = { 
      id: ulid(), 
      spaceId: store.activeSpaceId,
      role: 'assistant', 
      content: '',
      timestamp: Date.now(),
      msgType: 'chat'
    };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      await callOpenRouter(apiMessages, selectedModel, controller.signal, (chunk) => {
        assistantContent += chunk;
        assistantMsg.content = assistantContent;
        setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: assistantContent } : m));
      });

      if (assistantContent.trim()) {
        saveMessage(assistantMsg);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[AI] Error:', err);
        const errorMsg: Message = {
          id: ulid(),
          spaceId: store.activeSpaceId,
          role: 'assistant',
          content: `⚠️ **Error:** ${err.message || 'Unknown error occurred'}`,
          timestamp: Date.now(),
          msgType: 'system'
        };
        setMessages(prev => [...prev, errorMsg]);
        saveMessage(errorMsg);
      }
    } finally {
      setIsLoading(false);
      setStatus('');
      abortControllerRef.current = null;
    }
  };

  return (
    <AnimatePresence>
      {isChatOpen && (
        <motion.div
          initial={{ x: '-100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '-100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 200 }}
          className="fixed top-4 md:top-24 bottom-4 md:bottom-24 left-4 md:left-8 z-[9999] w-fit"
        >
          {/* Chat Panel */}
          <div
            id="chat-overlay"
            className="w-[calc(100%-32px)] md:w-[510px] h-full glass backdrop-blur-xl rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden border border-[var(--glass-border)]"
          >

          {/* HEADER */}
          <div className="sticky top-0 z-30 bg-[var(--bg-main)]/60 backdrop-blur-xl border-b border-[var(--glass-border)] flex flex-col">
            {/* Top Bar — matches Inspector */}
            <div className="px-4 py-3 md:px-5 flex justify-between items-center relative min-h-[44px]">
              <div className="flex-1" />
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]" />
                  <h3 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--text-primary)] leading-none">
                    Cyberia AI
                  </h3>
                </div>
              </div>
              <div className="flex-1 flex items-center justify-end gap-1 relative z-50">
                <button
                  onClick={() => setChatOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--glass-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Model & API Row — replaces Inspector's tab row */}
            <div className="flex items-center justify-between px-4 md:px-5 py-2.5 relative">
              <div className="flex-1 pointer-events-none" />
              <div className="flex items-center gap-2 relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="flex items-center justify-between w-64 px-3 py-1.5 rounded-lg bg-[var(--glass-bg)] hover:bg-[var(--bg-page)] border border-[var(--glass-border)] transition-all group"
                >
                  <span className="text-[9px] font-bold text-[var(--text-primary)] uppercase tracking-widest leading-none truncate">
                    {availableModels.find(m => m.id === selectedModel)?.name || selectedModel.split('/').pop() || 'Model'}
                  </span>
                  <ChevronDown className={cn("w-3 h-3 flex-shrink-0 text-[var(--text-muted)] transition-transform", showModelDropdown && "rotate-180")} />
                </button>

                <button
                  onClick={() => setEditingApiKey(true)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all",
                    apiKey
                      ? "bg-[var(--glass-bg)] border-[var(--glass-border)] text-green-500"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse"
                  )}
                  title={apiKey ? 'API Key configured' : 'API Key required'}
                >
                  <Key className="w-3 h-3" />
                </button>

                <AnimatePresence>
                  {showModelDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                      className="absolute top-full left-0 mt-2 w-64 bg-[var(--bg-main)] rounded-2xl border border-[var(--glass-border)] shadow-2xl overflow-hidden z-[100]"
                    >
                      {/* Search */}
                      <div className="relative border-b border-[var(--glass-border)]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={modelSearch}
                          onChange={e => setModelSearch(e.target.value)}
                          placeholder="Search models..."
                          onKeyDown={e => { if (e.key === 'Escape') setShowModelDropdown(false); }}
                          className="w-full bg-transparent pl-9 pr-3 py-2.5 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                        />
                      </div>
                      
                      <div className="py-0.5 max-h-[280px] overflow-y-auto custom-scroll">
                        {availableModels
                          .filter(m =>
                            !modelSearch ||
                            m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
                            m.id.toLowerCase().includes(modelSearch.toLowerCase())
                          )
                          .map((model) => (
                          <button
                            key={model.id}
                            onClick={() => { setSelectedModel(model.id); setShowModelDropdown(false); }}
                            className={cn(
                              "w-full flex items-center justify-between px-4 py-2.5 transition-all text-left",
                              selectedModel === model.id
                                ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                                : "hover:bg-[var(--bg-page)] text-[var(--text-primary)]"
                            )}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[11px] font-medium">{model.name}</span>
                              <span className="text-[9px] text-[var(--text-muted)]">{model.desc}</span>
                            </div>
                            {selectedModel === model.id && (
                              <svg className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                        {availableModels.filter(m => !modelSearch || m.name.toLowerCase().includes(modelSearch.toLowerCase()) || m.id.toLowerCase().includes(modelSearch.toLowerCase())).length === 0 && (
                          <div className="px-4 py-6 text-center text-[11px] text-[var(--text-muted)]">
                            No models match "{modelSearch}"
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex-1 pointer-events-none" />
            </div>
          </div>

          {/* API Key Setup Modal */}
          <AnimatePresence>
            {editingApiKey && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-[var(--bg-page)]/80 backdrop-blur-md flex items-center justify-center p-6 rounded-2xl"
              >
                <div className="w-full max-w-sm glass rounded-2xl p-6 border border-[var(--glass-border)] shadow-2xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                      <Key className="w-5 h-5 text-[var(--accent)]" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-bold text-[var(--text-primary)]">OpenRouter API Key</h3>
                      <p className="text-[10px] text-[var(--text-muted)]">Get yours at <span className="text-[var(--accent)]">openrouter.ai/keys</span></p>
                    </div>
                  </div>
                  <div className="relative mb-4">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="sk-or-v1-..."
                      className="w-full bg-[var(--bg-page)]/40 border border-[var(--glass-border)] rounded-xl px-3.5 py-2.5 pr-10 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/50 font-mono"
                      autoFocus
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingApiKey(false);
                        setApiKeyInput(apiKey);
                      }}
                      className="flex-1 px-3 py-2 rounded-xl text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] border border-[var(--glass-border)] transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setApiKey(apiKeyInput.trim());
                        setEditingApiKey(false);
                      }}
                      disabled={!apiKeyInput.trim()}
                      className="flex-1 px-3 py-2 rounded-xl text-[11px] font-semibold text-white bg-[var(--accent)]/90 hover:bg-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Save Key
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scroll"
          >
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-14 h-14 bg-[var(--glass-bg)] rounded-2xl flex items-center justify-center mb-5 border border-[var(--glass-border)] shadow-inner">
                  <MessageSquare className="w-6 h-6 text-[var(--text-muted)]" />
                </div>
                <h4 className="text-[12px] font-extrabold uppercase tracking-[0.25em] text-[var(--text-primary)] mb-2">
                  {apiKey ? 'Welcome to Agentic Workspace' : 'Configure API Key to Start'}
                </h4>
                <p className="text-[10px] font-medium text-[var(--text-muted)] max-w-[320px] leading-relaxed uppercase tracking-widest">
                  {apiKey 
                    ? 'Ready to map your thoughts. Ask me to research, organize, or create.'
                    : 'Click the key icon in the header to enter your OpenRouter API key.'}
                </p>
              </div>
            )}
            
            {messages.map((m) => {
              if (!m.content?.trim() && m.role === 'assistant') return null;
              
              const isEditing = editingMessageId === m.id;
              
              return (
                <div 
                  key={m.id} 
                  className={cn(
                    "flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-2 duration-500",
                    m.role === 'user' ? "items-end" : "items-start"
                  )}
                >
                  {isEditing ? (
                    <div className="max-w-[92%] w-full flex flex-col gap-2">
                      <textarea
                        value={editInput}
                        onChange={(e) => setEditInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSaveEdit(m);
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            handleCancelEdit();
                          }
                        }}
                        className="w-full bg-[var(--bg-page)]/40 border border-[var(--accent)]/50 rounded-2xl p-3.5 px-4 text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none min-h-[60px]"
                        autoFocus
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={handleCancelEdit}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-all"
                        >
                          <XIcon className="w-3 h-3" />
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(m)}
                          disabled={!editInput.trim()}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          <Check className="w-3 h-3" />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative max-w-[92%]">
                        <div className={cn(
                          "p-3.5 px-4 rounded-2xl text-[12px] leading-relaxed border shadow-sm prose prose-invert prose-xs break-words overflow-hidden",
                          m.role === 'user' 
                            ? "bg-[var(--accent)]/20 text-[var(--text-primary)] border-[var(--accent)]/30 rounded-tr-sm" 
                            : "bg-[var(--bg-page)]/20 text-[var(--text-primary)] border-[var(--glass-border)] rounded-tl-sm"
                        )}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{m.content}</ReactMarkdown>
                        </div>
                      </div>
                      <div className={cn(
                        "flex items-center gap-2 px-1",
                        m.role === 'user' ? "justify-start" : "justify-end"
                      )}>
                        {m.role === 'user' && (
                          <>
                            <button
                              onClick={() => handleStartEdit(m)}
                              className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                            >
                              <Pencil className="w-2.5 h-2.5" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(m.id)}
                              className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] text-[var(--text-muted)] hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                              Delete
                            </button>
                          </>
                        )}
                        {m.role === 'assistant' && (
                          <>
                            <button
                              onClick={() => handleCopyMessage(m)}
                              className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                            >
                              {copiedMessageId === m.id ? (
                                <Check className="w-2.5 h-2.5" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                              {copiedMessageId === m.id ? 'Copied' : 'Copy'}
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(m.id)}
                              className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] text-[var(--text-muted)] hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            
            {isLoading && (
              <div className="flex flex-col gap-2 items-start animate-pulse">
                {activeTool ? (
                  <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-4 py-2 rounded-xl flex items-center gap-3 shadow-[0_0_20px_var(--accent-glow)]">
                    <Loader2 className="w-3.5 h-3.5 text-[var(--accent)] animate-spin" />
                    <span className="text-[10px] font-semibold tracking-wide text-[var(--accent)]">
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
                    <span className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] ml-1">
                      {status || 'AI is thinking...'}
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
                onChange={(e) => {
                  setInput(e.target.value);
                  handleInputChange(e.target.value, e.target);
                }}
                onKeyDown={(e) => {
                  if (suggestions?.isOpen) {
                    handleSuggestionKeyDown(e);
                    return;
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!isLoading) e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={store.aiChatMode === 'chat' ? "Ask Cyberia AI..." : "Command Cyberia AI..."}
                rows={1}
                className="flex-1 bg-transparent border-none py-2.5 pl-3 pr-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none resize-none min-h-[36px] max-h-32 custom-scroll leading-relaxed"
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-all shadow-lg active:scale-95 group/cancel mb-0.5"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-[var(--accent)]/90 hover:bg-[var(--accent)] disabled:bg-[var(--glass-bg)] disabled:text-[var(--text-muted)] text-white rounded-lg transition-all shadow-lg active:scale-95 mb-0.5"
                >
                  <SendHorizonal className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Suggestion Dropdown for @thought and #stack references */}
              {suggestions?.isOpen && (
                <SuggestionDropdown
                  query={suggestions.query}
                  type={suggestions.type}
                  items={suggestions.items}
                  selectedIndex={suggestions.selectedIndex}
                  onSelect={(item) => insertSuggestion(item)}
                  onClose={() => setSuggestions(null)}
                  onKeyDown={handleSuggestionKeyDown}
                />
              )}
            </form>

            <div className="flex items-center justify-center pb-2">
              <div className="flex items-center h-8 bg-[var(--glass-bg)] rounded-lg p-1 border border-[var(--glass-border)]">
                <button
                  onClick={() => store.setAiChatMode('chat')}
                  className={cn(
                    "px-3 h-6 rounded-md transition-all duration-300 flex items-center gap-1.5",
                    store.aiChatMode === 'chat' 
                      ? "bg-[var(--accent)]/10 text-[var(--accent)]" 
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
                  )}
                >
                  <div className={cn("w-1.5 h-1.5 rounded-full transition-all", store.aiChatMode === 'chat' ? "bg-[var(--accent)]" : "bg-[var(--glass-border)]")} />
                  <span className="text-[9px] font-semibold tracking-wide mt-[1px]">Chat</span>
                </button>
                <div className="w-[1px] h-3 bg-[var(--glass-border)] mx-1"></div>
                <button
                  onClick={() => store.setAiChatMode('action')}
                  className={cn(
                    "px-3 h-6 rounded-md transition-all duration-300 flex items-center gap-1.5",
                    store.aiChatMode === 'action' 
                      ? "bg-[var(--status-doing)]/10 text-[var(--status-doing)]" 
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
                  )}
                >
                  <div className={cn("w-1.5 h-1.5 rounded-full transition-all", store.aiChatMode === 'action' ? "bg-[var(--status-doing)]" : "bg-[var(--glass-border)]")} />
                  <span className="text-[9px] font-semibold tracking-wide mt-[1px]">Action</span>
                </button>
              </div>
            </div>
          </div>
          </div>

          {/* Attached Toggle Button - Right Edge */}
          <button
            onClick={() => setChatOpen(false)}
            className="
              group absolute -right-[32px] top-1/2 -translate-y-1/2 h-[56px] w-[32px] rounded-r-2xl flex items-center justify-center 
              transition-all duration-300 pointer-events-auto
              bg-[var(--glass-bg)] border border-l-0 border-[var(--glass-border)] text-[var(--text-muted)]
              hover:text-[var(--text-primary)]
              shadow-lg shadow-[var(--glass-border)]
            "
          >
            <ChevronLeft className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-1 group-hover:translate-x-0" />
            <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 pointer-events-none whitespace-nowrap z-[10001]">
              <div className="glass px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                <span className="text-[10px] font-semibold tracking-wide text-[var(--text-primary)]/90">Close Cyberia AI</span>
              </div>
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatOverlay;
