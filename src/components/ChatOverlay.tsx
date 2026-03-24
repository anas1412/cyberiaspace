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
import { ORACLE_CONFIG, type PlanLimits } from '../constants';
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

// Helper component for model options in dropdown
const ModelItem: React.FC<{
  model: { id: string; name: string; desc: string };
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}> = ({ model, selected, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all border text-left",
      selected 
        ? "bg-[var(--accent)]/20 border-[var(--accent)]/30" 
        : "hover:bg-white/[0.05] border-transparent",
      disabled && "opacity-50 cursor-not-allowed grayscale"
    )}
  >
    <div className="flex flex-col gap-0.5">
      <span className={cn(
        "text-[10px] font-bold uppercase tracking-widest leading-none",
        selected ? "text-[var(--accent)]" : "text-[var(--text-primary)]"
      )}>
        {model.name}
      </span>
      <span className="text-[9px] font-medium text-[var(--text-muted)] opacity-80 uppercase tracking-wide leading-tight">
        {model.desc}
      </span>
    </div>
    {selected && <Check className="w-3 h-3 text-[var(--accent)] ml-2 flex-shrink-0" />}
  </button>
);

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
  const { user, modelConfig } = useAuthStore();
  const plan = user?.plan || 'free';
  const { openPricing } = useModalStore();
  
  // Use modelConfig from store (fetched from backend) or plan-specific fallbacks
  const limits = modelConfig?.config?.[plan] || 
    (plan === 'pro' 
      ? { 
          AI_DAILY_LIMIT: 10000, 
          AI_TOP_LIMIT: 15, 
          AI_MEDIUM_LIMIT: 60, 
          AI_SMALL_LIMIT: 500,
          AI_TOP_WEEKLY: 100,
          AI_MEDIUM_WEEKLY: 420,
          AI_SMALL_WEEKLY: 3500,
          AI_TOP_MONTHLY: 400,
          AI_MEDIUM_MONTHLY: 1800,
          AI_SMALL_MONTHLY: 15000
        } as PlanLimits
      : { AI_DAILY_LIMIT: 15, AI_TOP_LIMIT: 0, AI_MEDIUM_LIMIT: 0, AI_SMALL_LIMIT: 0, AI_TOP_WEEKLY: 0, AI_MEDIUM_WEEKLY: 0, AI_SMALL_WEEKLY: 0, AI_TOP_MONTHLY: 0, AI_MEDIUM_MONTHLY: 0, AI_SMALL_MONTHLY: 0 } as PlanLimits
    );
  const tiers = modelConfig?.tiers;
  
  const topModels = tiers?.top?.models || [];
  const mediumModels = tiers?.medium?.models || [];
  const smallModels = tiers?.small?.models || [];
  const freeModels = tiers?.free?.models || [];
  const allModels = [...mediumModels, ...smallModels, ...topModels, ...freeModels];
  const freeOnlyModels = freeModels;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [activeTool, setActiveTool] = useState<{ name: string; args: any } | null>(null);
  
  // Quota from auth store (single source of truth)
  const dailyUsage = useAuthStore((state) => state.user?.usage?.ai_daily_count ?? 0);
  const topUsage = useAuthStore((state) => state.user?.usage?.ai_top_count ?? 0);
  const mediumUsage = useAuthStore((state) => state.user?.usage?.ai_medium_count ?? 0);
  const smallUsage = useAuthStore((state) => state.user?.usage?.ai_small_count ?? 0);
  
  // Weekly/Monthly quota from auth store (single source of truth)
  const weeklyTopUsage = useAuthStore((state) => state.user?.usage?.weekly_top_count ?? 0);
  const weeklyMediumUsage = useAuthStore((state) => state.user?.usage?.weekly_medium_count ?? 0);
  const weeklySmallUsage = useAuthStore((state) => state.user?.usage?.weekly_small_count ?? 0);
  const monthlyTopUsage = useAuthStore((state) => state.user?.usage?.monthly_top_count ?? 0);
  const monthlyMediumUsage = useAuthStore((state) => state.user?.usage?.monthly_medium_count ?? 0);
  const monthlySmallUsage = useAuthStore((state) => state.user?.usage?.monthly_small_count ?? 0);
  
  // Anchors from auth store
  const dailyAnchor = useAuthStore((state) => state.user?.usage?.daily_anchor ?? null);
  
  const [activeTier, setActiveTier] = useState<'top' | 'medium' | 'small' | 'free'>(plan === 'pro' ? 'medium' : 'free');

  const [selectedModel, setSelectedModel] = useState(
    plan === 'pro' 
      ? (mediumModels[0]?.id || smallModels[0]?.id || topModels[0]?.id || freeModels[0]?.id || '')
      : (freeModels[0]?.id || '')
  );
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasInitializedRef = useRef(false);
  const prevPlanRef = useRef(plan);
  const userHasSelectedModelRef = useRef(false);

  const availableModels = plan === 'pro' ? allModels : freeOnlyModels;
  const currentModelInfo = allModels.find((m: any) => m.id === selectedModel) || availableModels[0];

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

// Set default model once on mount, or when plan actually changes (upgrade/downgrade)
// IMPORTANT: Only depend on 'plan' - model arrays are derived values that recreate on each render
// Adding them as dependencies would cause unwanted resets when modelConfig refreshes
useEffect(() => {
  const planChanged = prevPlanRef.current !== plan;

  if (!hasInitializedRef.current || planChanged) {
    const defaultModel = plan === 'pro'
    ? (mediumModels[0]?.id || smallModels[0]?.id || topModels[0]?.id || freeModels[0]?.id || '')
    : (freeModels[0]?.id || '');
    setSelectedModel(defaultModel);
    setActiveTier(plan === 'pro' ? 'medium' : 'free');

    prevPlanRef.current = plan;
    hasInitializedRef.current = true;
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [plan]);

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

  // Calculate reset time remaining for a specific period
  const getResetTimeDisplay = (anchor: string | null, period: 'daily' | 'weekly' | 'monthly') => {
    if (!anchor) return '—';
    
    const anchorDate = new Date(anchor + 'T00:00:00'); // Local midnight
    let nextReset: Date;
    
    if (period === 'daily') {
      nextReset = new Date(anchorDate);
      nextReset.setDate(nextReset.getDate() + 1);
    } else if (period === 'weekly') {
      nextReset = new Date(anchorDate);
      nextReset.setDate(nextReset.getDate() + 7);
    } else {
      // Monthly - go to next month
      nextReset = new Date(anchorDate);
      nextReset.setMonth(nextReset.getMonth() + 1);
    }
    
    const now = new Date();
    const msRemaining = nextReset.getTime() - now.getTime();
    
    if (msRemaining <= 0) return 'Soon';
    
    const hours = Math.floor(msRemaining / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${minutes}m`;
  };

  // Get the period that's the bottleneck (first exhausted) and remaining count
  const getTierStatus = (daily: number, weekly: number, monthly: number, dailyLimit: number, weeklyLimit: number, monthlyLimit: number) => {
    const dailyRemaining = dailyLimit - daily;
    const weeklyRemaining = weeklyLimit - weekly;
    const monthlyRemaining = monthlyLimit - monthly;
    
    // If monthly exhausted, show monthly reset time
    if (monthlyRemaining <= 0) {
      return { remaining: 0, period: 'monthly', exhausted: true };
    }
    // If weekly exhausted, show weekly reset time
    if (weeklyRemaining <= 0) {
      return { remaining: 0, period: 'weekly', exhausted: true };
    }
    // If daily exhausted, show daily reset time
    if (dailyRemaining <= 0) {
      return { remaining: 0, period: 'daily', exhausted: true };
    }
    
    // Not exhausted - show the smallest remaining
    const minRemaining = Math.min(dailyRemaining, weeklyRemaining, monthlyRemaining);
    return { remaining: minRemaining, period: 'daily', exhausted: false };
  };

  // Get reset timer for tier - ONLY shows time when exhausted, empty otherwise
  const getTierResetTimer = (daily: number, weekly: number, monthly: number, dailyAnchor: string | null, dailyLimit: number, weeklyLimit: number, monthlyLimit: number) => {
    const status = getTierStatus(daily, weekly, monthly, dailyLimit, weeklyLimit, monthlyLimit);
    
    if (!status.exhausted) {
      return ''; // Empty when not exhausted
    }
    
    // Return reset time based on which period is exhausted
    if (status.period === 'daily') {
      return getResetTimeDisplay(dailyAnchor, 'daily');
    } else if (status.period === 'weekly') {
      return getResetTimeDisplay(dailyAnchor, 'weekly');
    } else {
      return getResetTimeDisplay(dailyAnchor, 'monthly');
    }
  };

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

    // Free users now have unlimited access via free OpenRouter models


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

    let retryCount = 0;
    const MAX_RETRIES = 1;
    let response: Response | null = null;

    while (retryCount <= MAX_RETRIES) {
      try {
        const authStore = useAuthStore.getState();
        const token = await authStore.getOrRefreshToken();
        
        if (!token) {
          throw new Error('Unauthorized: Session expired');
        }

        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            messages: [...messages.filter(m => m.msgType !== 'system').slice(-ORACLE_CONFIG.HISTORY_WINDOW_SIZE), userMessage].map(m => ({
              role: m.role,
              content: m.content
            })),
            model: selectedModel,
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
          const { updateQuotaUsage } = useAuthStore.getState();
          updateQuotaUsage({ ai_daily_count: errorData.usage });
          return;
        }

        if (response.status === 401 && retryCount < MAX_RETRIES) {
          console.log('[ChatOverlay] Got 401, retrying with fresh token...');
          retryCount++;
          await authStore.refreshProfile();
          continue;
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
          useAuthStore.getState().signOut(); 
          return;
        }

        if (!response.ok) throw new Error('Failed to fetch from Oracle');
        
        break;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('[Oracle] Stream aborted by user');
        } else {
          console.error('[Oracle] Error:', err);
        }
        break;
      }
    }

    if (!response || !response.ok) {
      setIsLoading(false);
      setStatus('');
      abortControllerRef.current = null;
      return;
    }

    try {
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
                // Update centralized auth store (propagates to all components including Settings)
                const { updateQuotaUsage } = useAuthStore.getState();
                updateQuotaUsage({
                  ai_daily_count: data.count,
                  ai_top_count: data.top_count || 0,
                  ai_medium_count: data.medium_count || 0,
                  ai_small_count: data.small_count || 0,
                  weekly_top_count: data.weekly_top_count || 0,
                  weekly_medium_count: data.weekly_medium_count || 0,
                  weekly_small_count: data.weekly_small_count || 0,
                  monthly_top_count: data.monthly_top_count || 0,
                  monthly_medium_count: data.monthly_medium_count || 0,
                  monthly_small_count: data.monthly_small_count || 0,
                });
                
if (data.tier && data.autoSwitch) {
  if (activeTier !== 'free' && plan === 'pro') {
    const switchMsg: Message = {
      id: ulid(),
      spaceId: store.activeSpaceId,
      role: 'assistant',
      content: `⚠️ Auto-switched to ${data.tier} tier models`,
      timestamp: Date.now(),
      msgType: 'system'
    };
    setMessages(prev => [...prev, switchMsg]);
  }
  setActiveTier(data.tier);
}
                
                if (data.model && data.model !== selectedModel) {
                  setSelectedModel(data.model);
                }
                

              } else if (data.type === 'tool_call') {
                setActiveTool({ name: data.toolCall.toolName, args: data.toolCall.args });
                setStatus(data.isBatch 
                  ? `Batch Creating ${data.batchCount} Thoughts...` 
                  : getFriendlyToolName(data.toolCall.toolName));
                
                try {
                  const result = await executeOracleTool(data.toolCall, store);
                  
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
                  
                  if (['get_thought_details', 'read_file_content', 'read_files_content'].includes(data.toolCall.toolName) && result.success) {
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
                    
                    if (!followUpToken) throw new Error('Unauthorized: Session expired');

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
                        model: selectedModel,
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
                                  setActiveTool({ name: fData.toolCall.toolName, args: fData.toolCall.args });
                                  setStatus(getFriendlyToolName(fData.toolCall.toolName));
                                  const toolResult = await executeOracleTool(fData.toolCall, store);
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

          {/* HEADER */}
          <div className="px-4 py-3 md:px-5 border-b border-[var(--glass-border)] bg-[var(--bg-main)]/60 backdrop-blur-xl sticky top-0 z-30">
            <div className="flex justify-between items-start relative min-h-[44px]">
              
              <div className="flex-1" />

              {/* Absolute Center */}
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center pointer-events-none mt-0.5 z-[60]">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)] animate-pulse" />
                  <h3 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--text-primary)] leading-none">Oracle AI</h3>
                {plan === 'pro' && (
                  <div className={cn(
                    "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border",
                    activeTier === 'top' ? "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]" :
                    activeTier === 'medium' ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-500" :
                    activeTier === 'small' ? "bg-green-500/10 border-green-500/30 text-green-500" :
                    "bg-slate-500/10 border-slate-500/30 text-slate-500"
                  )}>
                    {activeTier}
                  </div>
                )}
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

                        <div className="max-h-[400px] overflow-y-auto custom-scroll">
                          {/* MEDIUM TIER - visible to all, disabled for free users */}
                          <div className="p-2">
                            <div className="flex justify-between items-center px-2 py-1 mb-1">
                              <span className="text-[8px] font-extrabold uppercase tracking-widest text-yellow-500">Recommended: Normal Models</span>
                              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                                {plan === 'pro' ? getTierResetTimer(mediumUsage, weeklyMediumUsage, monthlyMediumUsage, dailyAnchor, limits.AI_MEDIUM_LIMIT || 60, limits.AI_MEDIUM_WEEKLY || 420, limits.AI_MEDIUM_MONTHLY || 1800) : 'Pro only'}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {mediumModels.filter((m: any) => m.name.toLowerCase().includes(modelSearch.toLowerCase())).map((model: any) => (
                                <ModelItem key={model.id} model={model} selected={selectedModel === model.id} onClick={() => { setSelectedModel(model.id); setActiveTier('medium'); setShowModelDropdown(false); userHasSelectedModelRef.current = true; }} disabled={plan !== 'pro' || getTierStatus(mediumUsage, weeklyMediumUsage, monthlyMediumUsage, limits.AI_MEDIUM_LIMIT || 60, limits.AI_MEDIUM_WEEKLY || 420, limits.AI_MEDIUM_MONTHLY || 1800).exhausted} />
                              ))}
                            </div>
                          </div>

                          {/* SMALL TIER - visible to all, disabled for free users */}
                          {smallModels.length > 0 && (
                            <div className="p-2 border-t border-[var(--glass-border)]/20">
                              <div className="flex justify-between items-center px-2 py-1 mb-1">
                                <span className="text-[8px] font-extrabold uppercase tracking-widest text-green-500">Higher Usage: Small Models</span>
                                <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                                  {plan === 'pro' ? getTierResetTimer(smallUsage, weeklySmallUsage, monthlySmallUsage, dailyAnchor, limits.AI_SMALL_LIMIT || 500, limits.AI_SMALL_WEEKLY || 3500, limits.AI_SMALL_MONTHLY || 15000) : 'Pro only'}
                                </span>
                              </div>
                              <div className="space-y-1">
                                {smallModels.filter((m: any) => m.name.toLowerCase().includes(modelSearch.toLowerCase())).map((model: any) => (
                                  <ModelItem key={model.id} model={model} selected={selectedModel === model.id} onClick={() => { setSelectedModel(model.id); setActiveTier('small'); setShowModelDropdown(false); userHasSelectedModelRef.current = true; }} disabled={plan !== 'pro' || getTierStatus(smallUsage, weeklySmallUsage, monthlySmallUsage, limits.AI_SMALL_LIMIT || 500, limits.AI_SMALL_WEEKLY || 3500, limits.AI_SMALL_MONTHLY || 15000).exhausted} />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* TOP TIER - visible to all, disabled for free users */}
                          <div className="p-2 border-t border-[var(--glass-border)]/20">
                            <div className="flex justify-between items-center px-2 py-1 mb-1">
                              <span className="text-[8px] font-extrabold uppercase tracking-widest text-[var(--accent)]">Limited Usage: Premium Models</span>
                              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                                {plan === 'pro' ? getTierResetTimer(topUsage, weeklyTopUsage, monthlyTopUsage, dailyAnchor, limits.AI_TOP_LIMIT || 15, limits.AI_TOP_WEEKLY || 100, limits.AI_TOP_MONTHLY || 400) : 'Pro only'}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {topModels.filter((m: any) => m.name.toLowerCase().includes(modelSearch.toLowerCase())).map((model: any) => (
                                <ModelItem key={model.id} model={model} selected={selectedModel === model.id} onClick={() => { setSelectedModel(model.id); setActiveTier('top'); setShowModelDropdown(false); userHasSelectedModelRef.current = true; }} disabled={plan !== 'pro' || getTierStatus(topUsage, weeklyTopUsage, monthlyTopUsage, limits.AI_TOP_LIMIT || 15, limits.AI_TOP_WEEKLY || 100, limits.AI_TOP_MONTHLY || 400).exhausted} />
                              ))}
                            </div>
                          </div>

                          {/* FREE TIER */}
                          <div className="p-2 border-t border-[var(--glass-border)]/20">
                            <div className="flex justify-between items-center px-2 py-1 mb-1">
                              <span className="text-[8px] font-extrabold uppercase tracking-widest text-slate-500">Free</span>
                              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Unlimited (Experimental)</span>
                            </div>
                            <div className="space-y-1">
                              {freeModels.filter((m: any) => m.name.toLowerCase().includes(modelSearch.toLowerCase())).map((model: any) => (
                                <ModelItem key={model.id} model={model} selected={selectedModel === model.id} onClick={() => { setSelectedModel(model.id); setActiveTier('free'); setShowModelDropdown(false); userHasSelectedModelRef.current = true; }} />
                              ))}
                            </div>
                          </div>
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
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
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
                <AccessGuard user={user} mode="disable" feature="pro">
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
                Oracle AI is still in development
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatOverlay;