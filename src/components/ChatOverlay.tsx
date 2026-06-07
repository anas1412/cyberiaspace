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
import { X, SendHorizonal, MessageSquare, Loader2, Square, ChevronDown, ChevronLeft, Pencil, Trash2, Check, X as XIcon, Copy, Key, Eye, EyeOff, Search, Plus, MessageSquarePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { ORACLE_CONFIG } from '../constants';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { db, type ChatMessage, type ChatConversation } from '../db';
import { ulid } from 'ulid';
import { parseToolCalls } from '../services/ai/toolParser';
import { executeAiTool } from '../services/ai/executor';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Strips raw tool call syntax and internal IDs from AI responses
const sanitizeAssistantContent = (content: string): string => {
  // Remove XML-style tool call blocks (e.g. <tool_call><function=create_stack>...)
  const xmlToolCall = /<tool_call>[\s\S]*?<\/tool_call>\s*/g;
  let sanitized = content.replace(xmlToolCall, '').trim();

  // Remove lines that are standalone JS function call invocations (e.g. `create_stack({...})`)
  const jsToolCall = /^(?:const\s+\w+\s*=\s*)?(?:create_thought|create_thoughts|create_stack|link_thoughts|unlink_thoughts|update_thought|update_thoughts|delete_thoughts|delete_stack|delete_stacks|get_thought_details|read_file_content|read_files_content|update_stack|update_stacks|map_stack_to_thought)\s*\([\s\S]*?\)\s*;?\s*$/gm;
  sanitized = sanitized.replace(jsToolCall, '').trim();

  // Remove any code blocks containing JSON tool call objects
  sanitized = sanitized.replace(/```(?:json|js)?\s*\n\s*\{[^}]*?"toolName"[^}]*?\}\s*\n```\s*/g, '');

  return sanitized;
};

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

// Cache models across panel open/close (module-level)
let cachedModels: ModelOption[] | null = null;
let cachedModelsAt: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Minimal fallback in case fetching fails */
const FALLBACK_MODELS: ModelOption[] = [
  { id: 'openai/gpt-5.5', name: 'GPT 5.5', desc: 'OpenAI flagship', supportsTools: true },
];

export type ModelOption = { id: string; name: string; desc: string; promptPrice?: number; completionPrice?: number; supportsTools: boolean };

function formatPrice(price: number | undefined | null): string {
  if (price == null) return '';
  if (price === 0) return '$0';
  if (price < 0.0001) return `$${price.toFixed(6)}`;
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 1) return `$${price.toFixed(3)}`;
  if (price < 10) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(1)}`;
}

function getTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

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
  const [freeOnly, setFreeOnly] = useState(false);

  // Reset search/filter when dropdown closes
  useEffect(() => {
    if (!showModelDropdown) { setModelSearch(''); setFreeOnly(false); }
  }, [showModelDropdown]);

  // Fetch models live from OpenRouter API (with module-level cache)
  useEffect(() => {
    // 1. Use cached models if still fresh
    if (cachedModels && Date.now() - cachedModelsAt < CACHE_TTL) {
      setAvailableModels(cachedModels);
      setModelsLoaded(true);
      return;
    }

    // 2. Allow override URL via localStorage (for testing/power users)
    const overrideUrl = localStorage.getItem('cyberia-models-url');

    if (overrideUrl) {
      fetch(overrideUrl)
        .then(r => r.json())
        .then((data: ModelOption[]) => {
          if (Array.isArray(data) && data.length > 0) {
            // Default supportsTools to true for override data (assume custom list is curated)
            const withTools = data.map(m => ({ ...m, supportsTools: m.supportsTools ?? true }));
            cachedModels = withTools;
            cachedModelsAt = Date.now();
            setAvailableModels(withTools);
          }
        })
        .catch(err => console.error('[AI] Failed to load models from override URL:', err))
        .finally(() => setModelsLoaded(true));
      return;
    }

    // 3. Live fetch from OpenRouter
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    fetch('https://openrouter.ai/api/v1/models', { headers })
      .then(r => {
        if (!r.ok) throw new Error(`OpenRouter API ${r.status}`);
        return r.json();
      })
      .then((res: { data: { id: string; name: string; description?: string; supported_parameters?: string[]; pricing?: { prompt?: number | string; completion?: number | string } }[] }) => {
        if (!res.data || !Array.isArray(res.data) || res.data.length === 0) {
          throw new Error('Empty model list');
        }
        const allMapped: ModelOption[] = res.data.map(m => ({
          id: m.id,
          name: m.name,
          desc: m.description
            ? m.description.length > 80
              ? m.description.slice(0, 77) + '...'
              : m.description
            : '',
          // API returns per-token prices; multiply by 1M for the standard per-1M display
          promptPrice: m.pricing?.prompt != null ? Number(m.pricing.prompt) * 1_000_000 : undefined,
          completionPrice: m.pricing?.completion != null ? Number(m.pricing.completion) * 1_000_000 : undefined,
          supportsTools: Array.isArray(m.supported_parameters) && m.supported_parameters.includes('tools'),
        }));
        const mapped = allMapped.filter(m => m.supportsTools);
        cachedModels = mapped;
        cachedModelsAt = Date.now();
        setAvailableModels(mapped);
      })
      .catch(err => {
        console.error('[AI] Failed to fetch models from OpenRouter:', err);
        // Try to serve stale cache or fall back
        if (cachedModels) {
          setAvailableModels(cachedModels);
        }
      })
      .finally(() => setModelsLoaded(true));
  }, [apiKey]);

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

  // Conversation management
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showConversationList, setShowConversationList] = useState(false);
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

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

  // Load conversations + messages for the active space
  useEffect(() => {
    if (!store.activeSpaceId) {
      setConversations([]);
      setMessages([]);
      setCurrentConversationId(null);
      return;
    }

    const spaceId = store.activeSpaceId;

    (async () => {
      // Load conversations
      const convos = await db.chatConversations
        .where('spaceId')
        .equals(spaceId)
        .sortBy('updatedAt');

      setConversations(convos);

      // Migration: if messages exist without a conversation, create one
      const orphanCount = convos.length === 0
        ? await db.chatHistory.where('spaceId').equals(spaceId).count()
        : 0;

      if (orphanCount > 0) {
        const migrationConvo: ChatConversation = {
          id: ulid(),
          spaceId,
          title: 'Chat History',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await db.chatConversations.put(migrationConvo);
        // Update all orphan messages with the conversationId
        const orphans = await db.chatHistory
          .where('spaceId')
          .equals(spaceId)
          .toArray();
        for (const msg of orphans) {
          await db.chatHistory.put({ ...msg, conversationId: migrationConvo.id } as ChatMessage);
        }
        setConversations([migrationConvo]);
        setCurrentConversationId(migrationConvo.id);
        // Load migrated messages
        const msgs = orphans.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(msgs as Message[]);
        return;
      }

      // Select the most recent conversation, or the first one
      if (convos.length > 0) {
        const targetId = currentConversationId && convos.some(c => c.id === currentConversationId)
          ? currentConversationId
          : convos[convos.length - 1].id;
        setCurrentConversationId(targetId);
        const msgs = await db.chatHistory
          .where('[spaceId+conversationId]')
          .equals([spaceId, targetId])
          .sortBy('timestamp');
        setMessages(msgs as Message[]);
      } else {
        setCurrentConversationId(null);
        setMessages([]);
      }
    })();
  }, [store.activeSpaceId]);

  // Reload messages when switching conversations
  useEffect(() => {
    if (!store.activeSpaceId || !currentConversationId) return;
    db.chatHistory
      .where('[spaceId+conversationId]')
      .equals([store.activeSpaceId, currentConversationId])
      .sortBy('timestamp')
      .then(msgs => setMessages(msgs as Message[]))
      .catch(err => console.error("[AI] Failed to load messages:", err));
  }, [currentConversationId, store.activeSpaceId]);

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
    const cid = msg.conversationId || currentConversationId || '';
    const assistantMsg: Message = {
      id: ulid(),
      spaceId: store.activeSpaceId,
      conversationId: cid,
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
        // Parse and execute tool calls (same as handleSend)
        const toolCalls = parseToolCalls(assistantContent);
        let resultsSummary = '';
        if (toolCalls.length > 0) {
          const storeState = useStore.getState();
          const results: Array<{ toolName: string; success: boolean; label?: string; error?: string }> = [];
          for (const tc of toolCalls) {
            const result = await executeAiTool(tc, storeState);
            results.push({
              toolName: tc.toolName,
              success: result.success,
              label: (tc.args.name as string) || (tc.args.text as string) || '',
              error: result.error,
            });
          }
          const successCount = results.filter(r => r.success).length;
          if (successCount > 0) {
            const lines = results.filter(r => r.success).map(r => {
              if (r.toolName === 'create_stack') return `• Created stack "${r.label || 'unnamed'}"`;
              if (r.toolName === 'create_thought') return `• Created thought "${r.label || 'untitled'}"`;
              if (r.toolName === 'create_thoughts') return `• Created ${r.label || 'multiple'} thoughts`;
              if (r.toolName === 'link_thoughts') return `• Linked thoughts to "${r.label || 'stack'}"`;
              if (r.toolName === 'unlink_thoughts') return `• Unlinked thoughts from their stack`;
              if (r.toolName === 'delete_thoughts') return `• Deleted thoughts`;
              if (r.toolName === 'update_thought') return `• Updated thought "${r.label || ''}"`;
              return `• Executed ${r.toolName}`;
            }).filter(Boolean).join('\n');
            resultsSummary = `\n\n---\n\n✅ **Done:**\n${lines}`;
          }
          const failCount = results.filter(r => !r.success).length;
          if (failCount > 0) {
            resultsSummary += `\n\n⚠️ **Issues:**\n${results.filter(r => !r.success).map(r => `• ${r.toolName}: ${r.error}`).join('\n')}`;
          }
        }
        const sanitized = sanitizeAssistantContent(assistantContent);
        const finalContent = sanitized + resultsSummary;
        assistantMsg.content = finalContent;
        setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: finalContent } : m));
        saveMessage(assistantMsg);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[AI] Error:', err);
        const errorMsg: Message = {
          id: ulid(),
          spaceId: store.activeSpaceId,
          conversationId: cid,
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

  // ── Conversations CRUD ──────────────────────────────────────

  const createConversation = async () => {
    if (!store.activeSpaceId) return;
    const convo: ChatConversation = {
      id: ulid(),
      spaceId: store.activeSpaceId,
      title: 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.chatConversations.put(convo);
    setConversations(prev => [...prev, convo]);
    setCurrentConversationId(convo.id);
    setShowConversationList(false);
    setMessages([]);
  };

  const renameConversation = async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    await db.chatConversations.update(id, { title: trimmed, updatedAt: Date.now() });
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: trimmed } : c));
    setRenamingConversationId(null);
    setRenameInput('');
  };

  const deleteConversation = async (id: string) => {
    if (!store.activeSpaceId) return;
    // Remove all messages in this conversation
    await db.chatHistory.where('[spaceId+conversationId]').equals([store.activeSpaceId, id]).delete();
    // Remove the conversation itself
    await db.chatConversations.delete(id);
    setConversations(prev => prev.filter(c => c.id !== id));

    if (currentConversationId === id) {
      // Switch to most recent remaining, or clear
      const remaining = conversations.filter(c => c.id !== id);
      if (remaining.length > 0) {
        const next = remaining[remaining.length - 1];
        setCurrentConversationId(next.id);
      } else {
        setCurrentConversationId(null);
        setMessages([]);
      }
    }
    // Keep list open so user can delete multiple
  };

  const switchConversation = (id: string) => {
    setCurrentConversationId(id);
    setShowConversationList(false);
  };

  const getConversationTitle = (): string => {
    if (!currentConversationId) return '';
    const convo = conversations.find(c => c.id === currentConversationId);
    if (!convo) return '';
    return convo.title;
  };

  const ensureConversation = async (): Promise<string> => {
    if (currentConversationId && conversations.some(c => c.id === currentConversationId)) {
      return currentConversationId;
    }
    // Auto-create a conversation
    const convo: ChatConversation = {
      id: ulid(),
      spaceId: store.activeSpaceId!,
      title: 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.chatConversations.put(convo);
    setConversations(prev => [...prev, convo]);
    setCurrentConversationId(convo.id);
    return convo.id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !store.activeSpaceId) return;

    // Ensure there's an active conversation
    const activeConvoId = await ensureConversation();

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
      conversationId: activeConvoId,
      role: 'user', 
      content: contentForUI,
      timestamp: Date.now(),
      msgType: 'chat'
    };
    
    const apiContent = typeof messageContent === 'string' ? messageContent : messageContent;
    
    setMessages(prev => [...prev, userMessage]);
    saveMessage(userMessage);
    
    // Auto-name conversation after first user message if still "New Chat"
    const currentConvo = conversations.find(c => c.id === activeConvoId);
    if (currentConvo && currentConvo.title === 'New Chat') {
      const newTitle = input.trim().slice(0, 60) || 'New Chat';
      renameConversation(activeConvoId, newTitle);
    }

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
      ? `You are Cyberia AI in ACTION mode on a spatial-thinking canvas. You have tools to create, read, update, and delete thoughts and stacks. The user can tag thoughts with @name and stacks with #name. Current time: ${new Date().toLocaleString()}. Workspace context: ${contextString || 'Provided via references'}. Use tools to fulfill the user's request.

AVAILABLE TOOLS (use the exact function name):
- create_stack(ids: string[], name: string) — Link thoughts (by their IDs) into a new or existing stack. You MUST pick specific thought IDs from the workspace context.
- create_thought(text: string, type?: string, stackName?: string, status?: string, priority?: string) — Create a single thought
- create_thoughts(items: array of {text, type?, stackName?, ...}) — Create multiple thoughts at once
- update_thought(id: string, text?: string, stackName?: string, ...) — Update a thought's properties
- delete_thoughts(ids: string[]) — Delete thoughts by their IDs
- get_thought_details(ids: string[]) — Get full details of specific thoughts

CRITICAL: Tool call parameters MUST include thought IDs from the workspace context. The 'ids' parameter in tools like 'create_stack' requires specific thought IDs — scan the context JSON and pick the right ones. Without IDs the tool will fail.

IMPORTANT RULES:
- ✅ Tool calls MUST include IDs (they are required parameters — the system needs them to know which thoughts to act on; they never reach the user)
- ❌ NEVER mention, display, or describe IDs in your written response to the user
- Always refer to thoughts by their text/name or descriptive labels in your response
- After completing tool actions, summarize what you did in plain language — do NOT show the raw tool call syntax` 

      : `You are Cyberia AI in CHAT mode (read-only). The user can tag thoughts with @name and stacks with #name. Current time: ${new Date().toLocaleString()}. Workspace context: ${contextString || 'Provided via references'}. You can read thoughts but CANNOT modify them.

IMPORTANT RULES:
- NEVER show internal IDs to the user. Always refer to thoughts by their text/name or use descriptive labels.
- When listing or grouping thoughts, use their text content — not their internal ID.`;
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
      conversationId: activeConvoId,
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
        // ---- Phase 1: Parse tool calls from the raw response ----
        const toolCalls = parseToolCalls(assistantContent);

        // ---- Phase 2: Execute tool calls if any ----
        let resultsSummary = '';
        if (toolCalls.length > 0) {
          const storeState = useStore.getState();
          const results: Array<{ toolName: string; success: boolean; label?: string; error?: string }> = [];

          for (const tc of toolCalls) {
            const result = await executeAiTool(tc, storeState);
            results.push({
              toolName: tc.toolName,
              success: result.success,
              label: (tc.args.name as string) || (tc.args.text as string) || '',
              error: result.error,
            });
          }

          // Build human-readable summary
          const successCount = results.filter(r => r.success).length;
          const failCount = results.filter(r => !r.success).length;
          if (successCount > 0) {
            const lines = results
              .filter(r => r.success)
              .map(r => {
                if (r.toolName === 'create_stack') return `• Created stack "${r.label || 'unnamed'}"`;
                if (r.toolName === 'create_thought') return `• Created thought "${r.label || 'untitled'}"`;
                if (r.toolName === 'create_thoughts') return `• Created ${r.label || 'multiple'} thoughts`;
                if (r.toolName === 'link_thoughts') return `• Linked thoughts to "${r.label || 'stack'}"`;
                if (r.toolName === 'unlink_thoughts') return `• Unlinked thoughts from their stack`;
                if (r.toolName === 'delete_thoughts') return `• Deleted thoughts`;
                if (r.toolName === 'update_thought') return `• Updated thought "${r.label || ''}"`;
                return `• Executed ${r.toolName}`;
              })
              .filter(Boolean)
              .join('\n');
            resultsSummary = `\n\n---\n\n✅ **Done:**\n${lines}`;
          }
          if (failCount > 0) {
            const errors = results.filter(r => !r.success).map(r => `• ${r.toolName}: ${r.error}`).join('\n');
            resultsSummary += `\n\n⚠️ **Issues:**\n${errors}`;
          }
        }

        // ---- Phase 3: Sanitize and display ----
        const sanitized = sanitizeAssistantContent(assistantContent);
        const finalContent = sanitized + resultsSummary;
        assistantMsg.content = finalContent;
        setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: finalContent } : m));
        saveMessage(assistantMsg);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[AI] Error:', err);
        const errorMsg: Message = {
          id: ulid(),
          spaceId: store.activeSpaceId,
          conversationId: activeConvoId,
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
            {/* Top Bar — conversation title + controls */}
            <div className="px-4 py-3 md:px-5 flex items-center justify-between gap-2 min-h-[44px]">
              {/* Left: conversation list toggle */}
              <button
                onClick={() => setShowConversationList(!showConversationList)}
                className="flex items-center gap-1.5 flex-1 min-w-0 text-left group"
                title="Conversations"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)] flex-shrink-0" />
                <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate">
                  {getConversationTitle() || 'Cyberia AI'}
                </span>
                <ChevronDown className={cn(
                  "w-3 h-3 flex-shrink-0 text-[var(--text-muted)] transition-transform duration-200",
                  showConversationList && "rotate-180"
                )} />
              </button>

              {/* Right: new chat + close */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={createConversation}
                  title="New Chat"
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--glass-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setChatOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--glass-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Conversation List Overlay */}
            <AnimatePresence>
              {showConversationList && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                  className="overflow-hidden border-b border-[var(--glass-border)]"
                >
                  <div className="px-3 pb-3 max-h-[240px] overflow-y-auto custom-scroll space-y-0.5">
                    {conversations.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-[10px] text-[var(--text-muted)]">No conversations yet</p>
                        <button
                          onClick={createConversation}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-semibold hover:bg-[var(--accent)]/20 transition-all"
                        >
                          <MessageSquarePlus className="w-3 h-3" />
                          Start a Chat
                        </button>
                      </div>
                    ) : (
                      conversations.map((convo) => {
                        const isActive = convo.id === currentConversationId;
                        const isRenaming = renamingConversationId === convo.id;
                        const timeAgo = getTimeAgo(convo.updatedAt);

                        return (
                          <div
                            key={convo.id}
                            className={cn(
                              "group flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer",
                              isActive
                                ? "bg-[var(--accent)]/8 text-[var(--accent)]"
                                : "hover:bg-[var(--glass-bg)] text-[var(--text-primary)]"
                            )}
                            onClick={() => !isRenaming && switchConversation(convo.id)}
                          >
                            {isRenaming ? (
                              <input
                                value={renameInput}
                                onChange={e => setRenameInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') renameConversation(convo.id, renameInput);
                                  if (e.key === 'Escape') { setRenamingConversationId(null); setRenameInput(''); }
                                }}
                                onBlur={() => renameConversation(convo.id, renameInput)}
                                className="flex-1 bg-[var(--bg-page)]/40 border border-[var(--accent)]/50 rounded-md px-2 py-1 text-[11px] text-[var(--text-primary)] outline-none"
                                autoFocus
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <>
                                <div className={cn(
                                  "w-1 h-1 rounded-full flex-shrink-0 transition-all",
                                  isActive ? "bg-[var(--accent)]" : "bg-[var(--glass-border)]"
                                )} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-medium truncate leading-tight">
                                    {convo.title}
                                  </div>
                                  <div className="text-[8px] font-mono text-[var(--text-muted)] mt-0.5 tracking-wide">
                                    {timeAgo}
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                  <button
                                    onClick={e => { e.stopPropagation(); setRenamingConversationId(convo.id); setRenameInput(convo.title); }}
                                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--bg-page)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                                    title="Rename"
                                  >
                                    <Pencil className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); deleteConversation(convo.id); }}
                                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-all"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Model & API Row — full width */}
            <div className="flex items-center gap-2 px-4 md:px-5 py-2.5">
              <div className="relative flex-1" ref={dropdownRef}>
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="flex items-center justify-between w-full px-3 py-1.5 rounded-lg bg-[var(--glass-bg)] hover:bg-[var(--bg-page)] border border-[var(--glass-border)] transition-all group"
                >
                  <span className="text-[9px] font-bold text-[var(--text-primary)] uppercase tracking-widest leading-none truncate">
                    {availableModels.find(m => m.id === selectedModel)?.name || selectedModel.split('/').pop() || 'Model'}
                  </span>
                  <ChevronDown className={cn("w-3 h-3 flex-shrink-0 text-[var(--text-muted)] transition-transform", showModelDropdown && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {showModelDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                      className="absolute top-full left-0 mt-2 w-full bg-[var(--bg-main)] rounded-2xl border border-[var(--glass-border)] shadow-2xl overflow-hidden z-[100]"
                    >
                      {/* Search */}
                      <div className="relative flex items-center border-b border-[var(--glass-border)]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={modelSearch}
                          onChange={e => setModelSearch(e.target.value)}
                          placeholder="Search models..."
                          onKeyDown={e => { if (e.key === 'Escape') setShowModelDropdown(false); }}
                          className="flex-1 bg-transparent pl-9 pr-3 py-2.5 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                        />
                        <button
                          onClick={() => setFreeOnly(!freeOnly)}
                          className={cn(
                            "flex items-center gap-1 mr-2 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all",
                            freeOnly
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
                          )}
                          title="Show free models only"
                        >
                          <span className={freeOnly ? "opacity-100" : "opacity-50"}>FREE</span>
                        </button>
                      </div>
                      
                      <div className="py-0.5 max-h-[280px] overflow-y-auto custom-scroll">
                        {availableModels
                          .filter(m => {
                            if (freeOnly && !(m.promptPrice === 0 && m.completionPrice === 0)) return false;
                            if (!modelSearch) return true;
                            const q = modelSearch.toLowerCase();
                            return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
                          })
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
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                              <span className="text-[11px] font-medium truncate">{model.name}</span>
                              <span className="text-[9px] text-[var(--text-muted)] truncate">{model.desc}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {(model.promptPrice != null || model.completionPrice != null) && (
                                <div className="flex flex-col items-end gap-[1px]">
                                  {model.promptPrice === 0 && model.completionPrice === 0 ? (
                                    <span className="text-[8px] font-mono leading-tight text-[var(--text-dimmed)]">Free</span>
                                  ) : (
                                    <>
                                      <span className="text-[8px] font-mono leading-tight text-[var(--text-dimmed)]">
                                        {formatPrice(model.promptPrice)}i
                                      </span>
                                      <span className="text-[8px] font-mono leading-tight text-[var(--text-dimmed)]">
                                        {formatPrice(model.completionPrice)}o
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}
                              {selectedModel === model.id && (
                                <svg className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
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
