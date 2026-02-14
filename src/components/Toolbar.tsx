import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import { useAuthStore } from '../store/useAuthStore';
import { PLAN_CONFIG, type SubscriptionPlan } from '../constants';
import { Plus, Zap, Download, Upload, ChevronLeft, ChevronRight, Trash2, Edit3, Camera, MoreVertical, Keyboard, MousePointer2, Orbit, Columns3, CalendarDays, MonitorSmartphone, Eye, EyeOff, EyeClosed, ZoomIn, ZoomOut, RotateCcw, Undo2, Redo2, Settings, CircleHelp, MessageSquare, Send, Loader2, CheckCircle, Shield, Share2, ArrowLeft } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toCanvas } from 'html-to-image';
import AccountMenu from './AccountMenu';
import ShareDialog from './ShareDialog';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Toolbar: React.FC = () => {
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const setChatOpen = useStore((state) => state.setChatOpen);
  const isChatOpen = useStore((state) => state.isChatOpen);

  const spaces = useStore((state) => state.spaces);
  const thoughts = useStore((state) => state.thoughts);
  const setActiveSpace = useStore((state) => state.setActiveSpace);
  const addThought = useStore((state) => state.addThought);
  const updateSpace = useStore((state) => state.updateSpace);
  const deleteSpace = useStore((state) => state.deleteSpace);
  const addSpace = useStore((state) => state.addSpace);
  const reorderSpaces = useStore((state) => state.reorderSpaces);
  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  const exportData = useStore((state) => state.exportData);
  const importData = useStore((state) => state.importData);
  const clearWorkspace = useStore((state) => state.clearWorkspace);
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);
  const deferredPrompt = useStore((state) => state.deferredPrompt);
  const setDeferredPrompt = useStore((state) => state.setDeferredPrompt);

  const zoomIn = useStore((state) => state.zoomIn);
  const zoomOut = useStore((state) => state.zoomOut);
  const resetTransform = useStore((state) => state.resetTransform);
  const undo = useStore((state) => state.undo);
  const redo = useStore((state) => state.redo);
  const history = useStore((state) => state.history);
  const historyIndex = useStore((state) => state.historyIndex);
  const isReadOnly = useStore((state) => state.isReadOnly);
  const creatorName = useStore((state) => state.creatorName);
  const isSpaceLoading = useStore((state) => state.isSpaceLoading);

  const { openModal, openPricing } = useModalStore();

  const setTransform = useStore((state) => state.setTransform);

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const [isSpaceMenuOpen, setIsSpaceMenuOpen] = useState(false);
  const [isSystemMenuOpen, setIsSystemMenuOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState<'about' | 'issue' | 'contact'>('about');

  const getStatusColor = (space: any) => {
    if (isReadOnly) return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
    if (!space.publishedId) return 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]';

    const lastPub = space.lastPublished ? new Date(space.lastPublished).getTime() : 0;
    const updatedAt = space.updatedAt ? new Date(space.updatedAt).getTime() : 0;

    if (lastPub >= updatedAt - 1000) { // 1s tolerance
      return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
    } else {
      return 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]';
    }
  };

  // Quick Feedback State
  const [quickMessage, setQuickMessage] = useState('');
  const [quickType, setQuickType] = useState<'issue' | 'feedback' | 'feature'>('issue');
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false);
  const [quickSubmitStatus, setQuickSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Contact Form State
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);
  const [contactSubmitStatus, setContactSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const { user } = useAuthStore();
  const limits = (user?.plan && user.plan in PLAN_CONFIG) ? PLAN_CONFIG[user.plan as SubscriptionPlan] : PLAN_CONFIG.free;

  useEffect(() => {
    if (user?.email && !contactEmail) {
      setContactEmail(user.email);
      setContactName(user.name);
    }
  }, [user, contactEmail]);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactMessage.trim() || isContactSubmitting) return;

    setIsContactSubmitting(true);
    setContactSubmitStatus('idle');

    try {
      const res = await fetch('/api/feedback?action=contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          message: contactMessage
        })
      });

      if (res.ok) {
        setContactSubmitStatus('success');
        setContactMessage('');
        setTimeout(() => setContactSubmitStatus('idle'), 5000);
      } else {
        setContactSubmitStatus('error');
      }
    } catch {
      setContactSubmitStatus('error');
    } finally {
      setIsContactSubmitting(false);
    }
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMessage.trim() || isQuickSubmitting) return;

    setIsQuickSubmitting(true);
    setQuickSubmitStatus('idle');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: quickMessage,
          email: user?.email || 'anonymous',
          type: quickType
        })
      });

      if (res.ok) {
        setQuickSubmitStatus('success');
        setQuickMessage('');
        setTimeout(() => setQuickSubmitStatus('idle'), 3000);
      } else {
        setQuickSubmitStatus('error');
      }
    } catch {
      setQuickSubmitStatus('error');
    } finally {
      setIsQuickSubmitting(false);
    }
  };

  const lastUpdated = useStore((state) => state.lastUpdated);

  const formatLastUpdated = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = Math.abs(now.getTime() - date.getTime());
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const [isCapturing, setIsCapturing] = useState(false);

  // Close menus on click elsewhere
  React.useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isSystemMenuOpen && !target.closest('.system-tray-container')) {
        setIsSystemMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, [isSystemMenuOpen]);

  const handleExport = () => {
    exportData();
    setIsSystemMenuOpen(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      openModal({
        title: 'Overwrite Current Data?',
        description: 'Importing will delete all your current spaces and thoughts. This cannot be undone.',
        type: 'import_confirm',
        confirmText: 'Import & Overwrite',
        onConfirm: () => {
          importData(file);
        }
      });
    }
    // Reset the input value so the same file can be selected again
    e.target.value = '';
    setIsSystemMenuOpen(false);
  };

  const handleScreenshot = async () => {
    const worldEl = document.getElementById('world');
    if (!worldEl || thoughts.length === 0) return;

    setIsCapturing(true);

    try {
      // Detect Global Scale (from index.css rule)
      const body = document.querySelector('.app-body') || document.body;
      const bodyStyle = window.getComputedStyle(body);
      const bodyMatrix = new DOMMatrix(bodyStyle.transform);
      const globalScale = bodyMatrix.a || 1;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const worldRectRaw = worldEl.getBoundingClientRect();
      const worldRect = {
        left: worldRectRaw.left / globalScale,
        top: worldRectRaw.top / globalScale,
        width: worldRectRaw.width / globalScale,
        height: worldRectRaw.height / globalScale
      };

      // Get current world zoom scale to normalize measurements
      const worldStyle = window.getComputedStyle(worldEl);
      const matrix = new DOMMatrix(worldStyle.transform);
      const currentZoom = matrix.a || 1;

      thoughts.forEach(t => {
        const el = document.querySelector(`.thought-bulb[data-id="${t.id}"]`) as HTMLElement;
        if (!el) return;

        const rectRaw = el.getBoundingClientRect();
        const rect = {
          left: rectRaw.left / globalScale,
          top: rectRaw.top / globalScale,
          width: rectRaw.width / globalScale,
          height: rectRaw.height / globalScale
        };

        // Normalize coordinates relative to world, ignoring current zoom
        const x = (rect.left - worldRect.left) / currentZoom;
        const y = (rect.top - worldRect.top) / currentZoom;
        const w = rect.width / currentZoom;
        const h = rect.height / currentZoom;

        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + w > maxX) maxX = x + w;
        if (y + h > maxY) maxY = y + h;
      });

      if (minX === Infinity) return;

      const padding = 60; // More padding for cleaner edges
      const width = (maxX - minX) + (padding * 2);
      const height = (maxY - minY) + (padding * 2);
      const captureX = minX - padding;
      const captureY = minY - padding;

      // Extreme Stability: Calculate a safe internal scale
      const MAX_SAFE_DIMENSION = 4000;
      const scaleFactor = Math.min(1, MAX_SAFE_DIMENSION / Math.max(width, height));

      const canvas = await toCanvas(worldEl, {
        backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg-main').trim() || '#020408',
        cacheBust: true,
        pixelRatio: scaleFactor * 2, // 2x for higher quality
        skipFonts: true,
        style: {
          transform: `translate(${-captureX}px, ${-captureY}px) scale(1)`,
          position: 'absolute',
          width: `${width}px`,
          height: `${height}px`,
          margin: '0',
          padding: '0',
          left: '0',
          top: '0',
          filter: 'none',
          backdropFilter: 'none',
          boxShadow: 'none'
        },
        width: Math.floor(width * scaleFactor),
        height: Math.floor(height * scaleFactor),
        filter: (node: HTMLElement) => {
          const isUI = node.classList?.contains('ui-layer') ||
            node.id === 'connection-canvas' ||
            (node.tagName === 'BUTTON' && !node.closest?.('.thought-bulb'));
          return !isUI;
        }
      });

      // Export as compressed JPEG (10x smaller than PNG, much safer for RAM)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      if (!dataUrl || dataUrl.length < 100) throw new Error("Generated image is empty");

      const link = document.createElement('a');
      link.style.display = 'none';
      link.download = `cyberia_${activeSpace?.name || 'space'}.jpg`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
      }, 100);
    } catch (error) {
      console.error('Screenshot failed:', error);
      openModal({
        title: 'Screenshot Failed',
        description: 'The workspace might be too large or your device is out of memory. Try reducing items.',
        type: 'alert',
        confirmText: 'Okay'
      });
    } finally {
      setIsCapturing(false);
    }
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setIsSystemMenuOpen(false);
  };

  const handleAddThought = async () => {
    if (isReadOnly) return;
    if (thoughts.length >= limits.MAX_THOUGHTS_PER_SPACE) {
      const isPro = user?.plan === 'pro';
      openModal({
        title: 'Space is Full',
        description: isPro
          ? `This space has reached its maximum capacity of ${limits.MAX_THOUGHTS_PER_SPACE} thoughts.`
          : `You've reached the Free limit of ${limits.MAX_THOUGHTS_PER_SPACE} thoughts per space. Upgrade to Pro for more capacity.`,
        type: 'limit_thought',
        confirmText: isPro ? 'Okay' : 'Upgrade Now',
        onConfirm: isPro ? undefined : () => openPricing()
      });
      return;
    }
    const id = await addThought({});
    if (id !== -1) {
      setSelectedThoughtId(id);
      setInspectorOpen(true);
    }
  };

  const setViewMode = (mode: 'spatial' | 'kanban' | 'calendar') => {
    if (!activeSpace) return;

    // Only reset transform if switching TO a non-spatial mode
    if (mode !== 'spatial') {
      setTransform({ x: 0, y: 0, scale: 1 });
    } else if (activeSpace.mode !== 'spatial') {
      // If returning to spatial, reload the saved state
      setTransform({
        x: activeSpace.transformX ?? 0,
        y: activeSpace.transformY ?? 0,
        scale: activeSpace.transformScale ?? 1
      });
    }

    updateSpace(activeSpace.id, { mode });
  };

  const handleTogglePhysics = () => {
    if (!activeSpace) return;
    updateSpace(activeSpace.id, { physics: !activeSpace.physics });
  };

  const handleRenameSpace = () => {
    if (!activeSpace) return;
    openModal({
      title: 'Rename Space',
      type: 'rename',
      inputValue: activeSpace.name,
      confirmText: 'Rename',
      onConfirm: (newName) => {
        if (newName && newName.trim()) {
          updateSpace(activeSpace.id, { name: (newName as string).substring(0, 15) });
        }
      }
    });
    setIsSpaceMenuOpen(false);
  };

  const handleCreateSpace = () => {
    if (spaces.length >= limits.MAX_SPACES) {
      const isPro = user?.plan === 'pro';
      openModal({
        title: 'Limit Reached',
        description: isPro
          ? `You've reached the maximum limit of ${limits.MAX_SPACES} spaces.`
          : `You can only have up to ${limits.MAX_SPACES} spaces on the Free plan. Upgrade to Pro for more.`,
        type: 'limit_space',
        confirmText: isPro ? 'Okay' : 'Upgrade Now',
        onConfirm: isPro ? undefined : () => openPricing()
      });
      return;
    }
    openModal({
      title: 'Create New Space',
      type: 'new_space',
      confirmText: 'Create Space',
      onConfirm: (name) => {
        addSpace(name && (name as string).trim() ? (name as string).substring(0, 15) : 'New Space');
      }
    });
  };

  const handleDeleteSpace = () => {
    if (!activeSpace) return;
    if (spaces.length <= 1) {
      openModal({
        title: 'Cannot Delete',
        description: `You must have at least 1 active space.`,
        type: 'alert',
        confirmText: 'Okay'
      });
      return;
    }
    openModal({
      title: `Delete "${activeSpace.name}"?`,
      description: 'Are you sure? This will delete all thoughts in this space.',
      type: 'delete_space',
      confirmText: 'Delete',
      onConfirm: () => {
        deleteSpace(activeSpace.id);
      }
    });
    setIsSpaceMenuOpen(false);
  };

  const handleMoveSpace = (dir: number) => {
    if (!activeSpace) return;
    const currentIndex = spaces.findIndex(s => s.id === activeSpaceId);
    const newIndex = currentIndex + dir;

    if (newIndex >= 0 && newIndex < spaces.length) {
      const newSpaces = [...spaces];
      [newSpaces[currentIndex], newSpaces[newIndex]] = [newSpaces[newIndex], newSpaces[currentIndex]];
      reorderSpaces(newSpaces);
    }
  };

  return (
    <>
      {/* TOP UI */}
      <div className="fixed top-4 md:top-6 left-4 md:left-6 right-4 md:right-6 z-[9999] flex items-center justify-between pointer-events-none">
        {/* LEFT SIDE: Logo */}
        <div className="hidden lg:flex pointer-events-auto items-center h-[48px] flex-shrink-0">
          <a
            href="/"
            className="text-2xl font-bold tracking-tighter text-[var(--text-primary)] hover:opacity-70 transition-opacity"
          >
            CYBERIA
          </a>
        </div>

        {/* CENTER: Space Switcher - STRICT CENTERING */}
        <div className="md:absolute md:left-1/2 md:-translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-10 w-full md:w-auto px-4 md:px-0">
          <div className="max-w-full flex items-center h-[52px] glass rounded-full shadow-2xl transition-all pointer-events-auto border border-white/5 px-2">
            {isReadOnly ? (
              <div className="px-6 flex items-center justify-center gap-2">
                {isSpaceLoading ? (
                  <div className="flex items-center gap-3 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-indigo-500/50" />
                    <div className="h-2 w-32 bg-white/10 rounded-full" />
                    <div className="h-5 w-12 bg-white/5 rounded-full border border-white/5" />
                  </div>
                ) : (
                  <>
                    <div className={cn("w-2 h-2 rounded-full", getStatusColor(activeSpace))} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 truncate max-w-[300px]">
                      {creatorName}'s {activeSpace?.name || 'Space'}
                    </span>
                    <div className="flex items-center justify-center px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ml-2 h-5">
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Public</span>
                    </div>
                    {lastUpdated && (
                      <div className="flex items-center gap-1.5 ml-3 pl-3 border-l border-white/5 h-4 group/updated">
                        <div className="w-1 h-1 rounded-full bg-slate-600 group-hover/updated:bg-indigo-400 transition-colors" />
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.15em] whitespace-nowrap">
                          Updated {formatLastUpdated(lastUpdated)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 h-full min-w-max">
                <button
                  onClick={() => setIsSpaceMenuOpen(!isSpaceMenuOpen)}
                  className={cn(
                    "w-9 h-9 rounded-full transition-all flex-shrink-0 flex items-center justify-center border",
                    isSpaceMenuOpen
                      ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-[0_0_15px_var(--accent-glow)]"
                      : "text-slate-600 hover:text-white hover:bg-white/10 border-white/10"
                  )}
                  title="Space Settings"
                >
                  <Settings className={cn("w-3.5 h-3.5", isSpaceMenuOpen && "animate-spin-slow")} />
                </button>
                <div className="w-[1px] h-3 bg-white/10 mx-1"></div>

                {/* Space Tabs with visible custom scrollbar - UI VISIBILITY ONLY CAPPED (4 items on most screens, 6 on 1080p+) */}
                <div
                  id="space-switcher-list"
                  className="flex items-center gap-1 overflow-x-auto custom-scroll pb-1 max-w-[450px] 2xl:max-w-[750px] pointer-events-auto"
                  onWheel={(e) => {
                    e.stopPropagation();
                    e.currentTarget.scrollLeft += e.deltaY;
                  }}
                >
                  {spaces.map((space) => {
                    const isActive = space.id === activeSpaceId;
                    return (
                      <button
                        key={space.id}
                        onClick={() => setActiveSpace(space.id)}
                        className={cn(
                          "px-3 h-9 min-w-[110px] md:min-w-[120px] rounded-full text-[10px] uppercase font-black tracking-widest flex-shrink-0 transition-all duration-500 flex items-center justify-center gap-2",
                          isActive
                            ? "bg-white/10 text-white border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                            : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] border border-transparent"
                        )}
                      >
                        <div className={cn(
                          "w-1 h-1 rounded-full bg-[var(--accent-secondary)] shadow-[0_0_8px_var(--accent)]",
                          getStatusColor(space)
                        )} />
                        <span className="truncate">{space.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Add Space Button: Correctly tied to User Plan Limits (Free vs Pro) */}
                {spaces.length < limits.MAX_SPACES && (
                  <>
                    <div className="w-[1px] h-3 bg-white/10 mx-1"></div>
                    <button
                      onClick={handleCreateSpace}
                      className="w-9 h-9 rounded-full text-slate-600 hover:text-white hover:bg-white/10 transition-all flex-shrink-0 flex items-center justify-center border border-white/10 border-dashed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* WEB SPACE SETTINGS */}
          {activeSpace && isSpaceMenuOpen && (
            <div className="absolute top-full mt-2 flex flex-col items-center gap-1.5 transition-all animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-auto">
              {!isReadOnly && (
                <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1 shadow-2xl">
                  <button
                    onClick={handleRenameSpace}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-2 group"
                    title="Rename Space"
                  >
                    <Edit3 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    <span className="text-[8px] font-black uppercase tracking-widest hidden sm:inline">Rename</span>
                  </button>
                  <div className="w-px h-3 bg-white/5 mx-1" />
                  <button
                    onClick={() => {
                      openModal({
                        title: 'Share Space',
                        type: 'custom',
                        content: <ShareDialog spaceId={activeSpace.id} />
                      });
                      setIsSpaceMenuOpen(false);
                    }}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-indigo-400 hover:text-indigo-300 transition-all flex items-center gap-2 group"
                    title="Share Space"
                  >
                    <Share2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    <span className="text-[8px] font-black uppercase tracking-widest hidden sm:inline">Share Link</span>
                  </button>
                  <div className="w-px h-3 bg-white/5 mx-1" />
                  <button
                    onClick={() => handleMoveSpace(-1)}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all group"
                    title="Move Left"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                  </button>
                  <button
                    onClick={() => handleMoveSpace(1)}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all group"
                    title="Move Right"
                  >
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                  <div className="w-px h-3 bg-white/10 mx-1" />
                  <button
                    onClick={handleDeleteSpace}
                    className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-500 hover:text-red-400 transition-all flex items-center gap-2 group"
                    title="Delete Space"
                  >
                    <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    <span className="text-[8px] font-black uppercase tracking-widest hidden sm:inline">Delete</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT SIDE: View Switcher */}
        <div className="flex items-center gap-2 flex-shrink-0 pointer-events-none z-20">
          <div className="flex items-center h-[48px] p-1.5 glass rounded-2xl shadow-2xl transition-all pointer-events-auto border border-white/5">
            {[
              { id: 'spatial', icon: Orbit, color: 'bg-[var(--accent)]' },
              { id: 'kanban', icon: Columns3, color: 'bg-purple-500' },
              { id: 'calendar', icon: CalendarDays, color: 'bg-amber-500' }
            ].map((mode) => {
              const isActive = activeSpace?.mode === mode.id;
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id as 'spatial' | 'kanban' | 'calendar')}
                  className={cn(
                    "px-3 md:px-4 h-full rounded-xl transition-all duration-300 flex items-center gap-2 group/mode",
                    isActive
                      ? "bg-white/10 text-white shadow-xl"
                      : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]"
                  )}
                >
                  <div className={cn(
                    "w-1 h-1 md:w-1.5 md:h-1.5 rounded-full transition-all",
                    isActive ? mode.color : "bg-white/10 group-hover/mode:bg-white/30"
                  )} />
                  <Icon className={cn("w-3.5 h-3.5 md:w-4 md:h-4 transition-transform", isActive ? "scale-110" : "scale-90")} />
                  <span className={cn(
                    "text-[9px] font-black uppercase tracking-widest transition-all overflow-hidden whitespace-nowrap hidden 2xl:inline",
                    isActive ? "w-14 opacity-100" : "w-0 opacity-0"
                  )}>
                    {mode.id}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="pointer-events-auto">
            <AccountMenu />
          </div>
        </div>
      </div>

      {/* NEW THOUGHT FAB / EXIT BUTTON */}
      {!isReadOnly ? (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[10000] pointer-events-none flex flex-col items-center transition-all duration-300">
          <button
            onClick={handleAddThought}
            className="group relative flex items-center justify-center w-16 h-16 bg-[var(--bg-gradient-to)]/40 backdrop-blur-2xl text-white rounded-full border border-white/10 shadow-[0_0_50px_var(--accent-glow)] transition-all hover:scale-110 active:scale-95 hover:border-[var(--accent)]/40 pointer-events-auto"
          >
            {/* Tooltip */}
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap">
              <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex flex-col items-center gap-1 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/80">New Thought</span>
                  <div className="w-[1px] h-2 bg-white/10 mx-0.5" />
                  <kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-black text-[var(--accent-secondary)]">SPACE</kbd>
                </div>
                <span className="text-[7px] font-black uppercase tracking-[0.2em] text-white/30 italic">or drag files to import</span>
              </div>
            </div>

            <div className="absolute inset-0 rounded-full bg-[var(--accent)]/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
            <Plus className="w-8 h-8 text-slate-400 group-hover:text-white transition-all group-hover:rotate-90 relative z-10" />
          </button>
        </div>
      ) : (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[10000] pointer-events-none flex flex-col items-center transition-all duration-300">
          <button
            onClick={() => window.location.href = '/'}
            className="group relative flex items-center gap-3 px-6 py-3 bg-[var(--bg-gradient-to)]/40 backdrop-blur-2xl text-white rounded-full border border-white/10 shadow-[0_0_50px_var(--accent-glow)] transition-all hover:scale-105 active:scale-95 hover:border-[var(--accent)]/40 pointer-events-auto"
          >
            {/* Tooltip */}
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap">
              <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Return to Your Workspace</span>
              </div>
            </div>

            <div className="absolute inset-0 rounded-full bg-[var(--accent)]/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
            <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-white transition-all relative z-10" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-all relative z-10">Exit</span>
          </button>
        </div>
      )}

      {/* SYSTEM TRAY */}
      <div className="fixed bottom-4 md:bottom-8 right-4 md:right-8 z-[9999] flex flex-col items-end gap-3 pointer-events-none system-tray-container">
        <div className={cn(
          "glass p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border border-white/10 shadow-2xl flex flex-col gap-1 transition-all pointer-events-auto w-64 md:w-72 animate-in fade-in slide-in-from-bottom-2 duration-300",
          isSystemMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}>
          {/* Theme Selector */}
          <div className="px-1 md:px-2 py-3 border-b border-white/5 mb-3">
            <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Workspace Theme</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'cyberia', label: 'Cyber', color: '#6366f1' },
                { id: 'sakura', label: 'Sakura', color: '#fdb9c8' },
                { id: 'neon', label: 'Neon', color: '#10b981' }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id as 'cyberia' | 'sakura' | 'neon')}
                  className={cn(
                    "flex flex-col items-center gap-2.5 p-2.5 rounded-xl border transition-all",
                    theme === t.id
                      ? "bg-white/10 border-white/20 shadow-lg"
                      : "border-transparent hover:bg-white/5"
                  )}
                >
                  <div className="w-4 h-4 rounded-full shadow-lg" style={{ backgroundColor: t.color }} />
                  <span className={cn(
                    "text-[8px] md:text-[9px] font-bold uppercase tracking-widest",
                    theme === t.id ? "text-white" : "text-slate-500"
                  )}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {deferredPrompt && (
            <button onClick={handleInstall} className="flex items-center gap-3 px-3 py-3 rounded-xl md:rounded-2xl bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-[var(--accent-secondary)] transition-all mb-1 border border-[var(--accent)]/20">
              <MonitorSmartphone className="w-3.5 h-3.5" /> Install App
            </button>
          )}

          <button onClick={handleExport} className="flex items-center gap-3 px-3 py-3 rounded-xl md:rounded-2xl hover:bg-white/5 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-300 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export Data
          </button>
          <label className="flex items-center gap-3 px-3 py-3 rounded-xl md:rounded-2xl hover:bg-white/5 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-300 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Import Data
            <input type="file" className="hidden" accept=".json" onChange={handleImport} />
          </label>
          <button onClick={handleScreenshot} disabled={isCapturing} className="flex items-center gap-3 px-3 py-3 rounded-xl md:rounded-2xl hover:bg-white/5 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-300 transition-colors">
            <Camera className="w-3.5 h-3.5" /> {isCapturing ? 'Saving...' : 'Screenshot'}
          </button>

          <button
            onClick={() => {
              openModal({
                title: 'Terms of Service',
                type: 'terms',
                confirmText: 'Acknowledged'
              });
              setIsSystemMenuOpen(false);
            }}
            className="flex items-center gap-3 px-3 py-3 rounded-xl md:rounded-2xl hover:bg-white/5 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-400 transition-colors"
          >
            <Shield className="w-3.5 h-3.5" /> Terms of Service
          </button>

          <div className="h-[1px] bg-white/5 my-3 mx-1"></div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                openModal({
                  title: 'Clear Workspace?',
                  description: 'This will permanently delete all your spaces, thoughts, and stacks. This cannot be undone.',
                  type: 'reset_confirm',
                  confirmText: 'Clear All',
                  onConfirm: clearWorkspace
                });
                setIsSystemMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl hover:bg-red-500/10 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-red-400 transition-colors border border-transparent hover:border-red-500/10"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          </div>
        </div>

        <div className="flex gap-2 pointer-events-auto">
          {!isReadOnly && user && (
            <div className="relative group">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
                <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Ask Oracle</span>
                </div>
              </div>

              <button
                onClick={() => {
                  if (!limits.AI_ENABLED) {
                    openPricing();
                    return;
                  }
                  setChatOpen(!isChatOpen);
                }}
                className={cn(
                  "glass w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-2xl border border-white/5 transition-all",
                  !limits.AI_ENABLED ? "opacity-40 grayscale hover:opacity-100 transition-opacity" :
                    isChatOpen
                      ? "bg-[var(--accent)] text-white shadow-[0_0_20px_var(--accent-glow)]"
                      : "text-[var(--accent)] hover:bg-[var(--accent)]/10"
                )}
              >
                {!limits.AI_ENABLED ? (
                  <EyeOff className="w-4 h-4 md:w-5 md:h-5" />
                ) : isChatOpen ? (
                  <Eye className="w-4 h-4 md:w-5 md:h-5" />
                ) : (
                  <EyeClosed className="w-4 h-4 md:w-5 md:h-5" />
                )}
              </button>
            </div>
          )}

          <button
            onClick={() => setIsShortcutsOpen(!isShortcutsOpen)}
            className={cn(
              "group relative hidden md:flex glass w-12 h-12 items-center justify-center rounded-2xl transition-all border border-white/5",
              isShortcutsOpen ? "bg-[var(--accent)] text-white" : "text-slate-400 hover:text-white"
            )}
          >
            {/* Tooltip */}
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
              <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Command Center</span>
              </div>
            </div>
            <Keyboard className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsHelpOpen(!isHelpOpen)}
            className={cn(
              "group relative glass w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-2xl transition-all border border-white/5",
              isHelpOpen ? "bg-[var(--accent)] text-white" : "text-slate-400 hover:text-white"
            )}
          >
            {/* Tooltip */}
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
              <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Help</span>
              </div>
            </div>
            <CircleHelp className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <button
            onClick={() => setIsSystemMenuOpen(!isSystemMenuOpen)}
            className={cn(
              "group relative glass w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-2xl transition-all border border-white/5",
              isSystemMenuOpen ? "bg-[var(--accent)] text-white" : "text-slate-400 hover:text-white"
            )}
          >
            {/* Tooltip */}
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
              <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">System Menu</span>
              </div>
            </div>
            <MoreVertical className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>
      {/* STATUS BAR */}
      <div className="fixed bottom-4 md:bottom-8 left-4 md:left-8 z-[9999] flex items-center gap-2 pointer-events-none">
        <div className="glass px-3 md:px-4 h-[40px] md:h-[48px] rounded-2xl flex items-center gap-2 md:gap-4 border border-white/5 pointer-events-auto">
          {/* Thought Count */}
          <div className="group relative flex items-center justify-center gap-2 md:gap-3 cursor-default">
            {/* Tooltip */}
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
              <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Capacity</span>
                <div className="w-[1px] h-2 bg-white/10 mx-0.5" />
                <span className="text-[10px] font-black text-[var(--accent-secondary)]">{limits.MAX_THOUGHTS_PER_SPACE} Max</span>
              </div>
            </div>

            <span className={cn(
              "w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all shadow-[0_0_10px_currentColor]",
              thoughts.length > limits.MAX_THOUGHTS_PER_SPACE ? "bg-red-500 text-red-500" : "bg-green-500 text-green-500"
            )}></span>
            <span className={cn(
              "text-[9px] md:text-[10px] uppercase font-black tracking-widest transition-colors",
              thoughts.length > limits.MAX_THOUGHTS_PER_SPACE ? "text-red-400" : "text-white/80"
            )}>
              <span>{thoughts.length}</span>
              <span className="hidden sm:inline">/{limits.MAX_THOUGHTS_PER_SPACE} {thoughts.length > limits.MAX_THOUGHTS_PER_SPACE ? 'Overflow' : 'Thoughts'}</span>
            </span>
          </div>

          <div className="h-3 w-[1px] bg-white/10 mx-0.5"></div>

          {/* Physics Toggle */}
          <button
            onClick={handleTogglePhysics}
            className={cn(
              "group relative flex items-center gap-2 transition-all text-[9px] md:text-[10px] font-black uppercase tracking-widest",
              activeSpace?.physics ? "text-[var(--accent-secondary)]" : "text-slate-600"
            )}
          >
            {/* Tooltip */}
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
              <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Physics</span>
                <div className="w-[1px] h-2 bg-white/10 mx-0.5" />
                <span className={cn("text-[8px] font-black uppercase tracking-widest", activeSpace?.physics ? "text-green-400" : "text-slate-400")}>
                  {activeSpace?.physics ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>

            <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden xl:inline">Physics</span>
          </button>

          {/* History Controls */}
          <div className="hidden sm:flex h-3 w-[1px] bg-white/10 mx-0.5"></div>
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="group relative p-1.5 md:p-2 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all rounded-lg"
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
                <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Undo</span>
                  <div className="w-[1px] h-2 bg-white/10 mx-0.5" />
                  <kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-black text-[var(--accent-secondary)]">CTRL+Z</kbd>
                </div>
              </div>
              <Undo2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="group relative p-1.5 md:p-2 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all rounded-lg"
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
                <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Redo</span>
                  <div className="w-[1px] h-2 bg-white/10 mx-0.5" />
                  <kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-black text-[var(--accent-secondary)]">CTRL+Y</kbd>
                </div>
              </div>
              <Redo2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          </div>

          {/* Zoom Controls (Spatial Only) */}
          {activeSpace?.mode === 'spatial' && (
            <>
              <div className="h-3 w-[1px] bg-white/10 mx-0.5"></div>
              <div className="flex items-center gap-1">
                <button
                  onClick={zoomIn}
                  className="group relative p-2 hover:bg-white/10 text-slate-400 hover:text-white transition-colors rounded-lg"
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
                    <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Zoom In</span>
                      <div className="w-[1px] h-2 bg-white/10 mx-0.5" />
                      <kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-black text-[var(--accent-secondary)]">WHEEL UP</kbd>
                    </div>
                  </div>
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={zoomOut}
                  className="group relative p-2 hover:bg-white/10 text-slate-400 hover:text-white transition-colors rounded-lg"
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
                    <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Zoom Out</span>
                      <div className="w-[1px] h-2 bg-white/10 mx-0.5" />
                      <kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-black text-[var(--accent-secondary)]">WHEEL DN</kbd>
                    </div>
                  </div>
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={resetTransform}
                  className="group relative p-2 hover:bg-white/10 text-slate-400 hover:text-white transition-colors rounded-lg"
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
                    <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Reset View</span>
                    </div>
                  </div>
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* SHORTCUTS MODAL */}
      {isShortcutsOpen && (
        <div className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-md flex items-center justify-center p-10 pointer-events-auto" onClick={() => setIsShortcutsOpen(false)}>
          <div className="glass max-w-md w-full p-10 rounded-[3rem] border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--accent-secondary)]">Command Center</h3>
              <button onClick={() => setIsShortcutsOpen(false)} className="text-slate-500 hover:text-white"><Plus className="w-6 h-6 rotate-45" /></button>
            </div>
            <div className="space-y-6">
              {[
                { keys: ['Space'], label: 'Create New Thought' },
                { keys: ['Del', 'Backspace'], label: 'Delete Selected' },
                { keys: ['Ctrl', 'V'], label: 'Paste (Text, Image, YT)' },
                { keys: ['Drag'], label: 'Import (Images, TXT, CSV)' },
                { keys: ['L-Click', 'Drag'], label: 'Select Thoughts' },
                { keys: ['Ctrl', 'L-Click'], label: 'Multi-Select' },
                { keys: ['Enter'], label: 'Confirm Modal / Open Editor' },
                { keys: ['Alt', 'L-Click'], label: 'Pan Viewport' },
                { keys: ['Wheel'], label: 'Zoom In / Out' },
              ].map((s, i) => (
                <div key={i} className="flex justify-between items-center group">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">{s.label}</span>
                  <div className="flex gap-1">
                    {s.keys.map(k => (
                      <kbd key={k} className="bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-[9px] font-black text-[var(--accent-secondary)] min-w-[30px] text-center">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 pt-8 border-t border-white/5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent-secondary)]">
                <MousePointer2 className="w-5 h-5" />
              </div>
              <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500 leading-relaxed">
                Middle-click or Alt+Drag to move around the infinite workspace.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* HELP MODAL */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-md flex items-center justify-center p-10 pointer-events-auto" onClick={() => setIsHelpOpen(false)}>
          <div className="glass max-w-lg w-full p-10 rounded-[3rem] border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[var(--accent-secondary)]">System Help</h3>
              <button onClick={() => setIsHelpOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-8 bg-white/5 p-2 rounded-2xl border border-white/5">
              {[
                { id: 'about', label: 'About Us' },
                { id: 'issue', label: 'Found an Issue?' },
                { id: 'contact', label: 'Contact Us' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveHelpTab(tab.id as 'about' | 'issue' | 'contact')}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all",
                    activeHelpTab === tab.id
                      ? "bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent-glow)]"
                      : "text-slate-500 hover:text-white hover:bg-white/5"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="min-h-[200px] animate-in fade-in slide-in-from-bottom-2 duration-300">
              {activeHelpTab === 'about' && (
                <div className="space-y-5">
                  <h4 className="text-[11px] font-black text-white uppercase tracking-widest">About Cyberia</h4>
                  <p className="text-xs text-slate-400 leading-relaxed italic">
                    Cyberia is a spatial workspace designed for fluid information management. We treat data as physical objects to help you visualize connections and organize your thoughts naturally.
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Designed for non-linear thinkers, visionaries, and digital architects. We believe productivity shouldn't feel like a spreadsheet. It should feel like a world.
                  </p>
                  <button
                    onClick={() => {
                      openModal({
                        title: 'Terms of Service',
                        type: 'terms',
                        confirmText: 'Acknowledged'
                      });
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-indigo-400 transition-colors flex items-center gap-2 mt-4"
                  >
                    <Shield className="w-3 h-3" /> View Terms of Service
                  </button>
                </div>
              )}

              {activeHelpTab === 'issue' && (
                <div className="space-y-5">
                  <h4 className="text-[11px] font-black text-white uppercase tracking-widest">Report an Issue</h4>

                  {quickSubmitStatus === 'success' ? (
                    <div className="py-6 text-center space-y-3 bg-green-500/5 border border-green-500/10 rounded-2xl animate-in zoom-in-95 duration-300">
                      <CheckCircle className="w-8 h-8 text-green-400 mx-auto" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-green-400">Report Transmitted</p>
                    </div>
                  ) : (
                    <form onSubmit={handleQuickSubmit} className="space-y-3">
                      <div className="flex gap-1.5 p-1 bg-black/40 border border-white/5 rounded-xl">
                        {(['issue', 'feedback', 'feature'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setQuickType(t)}
                            className={cn(
                              "flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                              quickType === t
                                ? "bg-white/10 text-white shadow-md border border-white/10"
                                : "text-slate-600 hover:text-slate-400"
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <textarea
                        required
                        value={quickMessage}
                        onChange={(e) => setQuickMessage(e.target.value)}
                        placeholder="Quick report... (System logs will be attached)"
                        className="w-full h-24 bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-white outline-none focus:border-[var(--accent)]/50 transition-all resize-none"
                      />
                      <button
                        type="submit"
                        disabled={isQuickSubmitting || !quickMessage.trim()}
                        className="w-full h-10 bg-[var(--accent)] hover:bg-[var(--accent)]/90 disabled:opacity-50 text-white rounded-xl font-black uppercase text-[9px] tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        {isQuickSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3 h-3" /> Send Quick Report</>}
                      </button>
                    </form>
                  )}

                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-white/5"></div>
                    <span className="flex-shrink mx-4 text-[8px] font-black uppercase tracking-widest text-slate-700">OR</span>
                    <div className="flex-grow border-t border-white/5"></div>
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={() => window.open('/feedback', '_blank')}
                      className="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/10 transition-all flex items-center justify-center gap-2 group"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Open Feedback Portal
                    </button>
                  </div>
                </div>
              )}

              {activeHelpTab === 'contact' && (
                <div className="space-y-5">
                  <h4 className="text-[11px] font-black text-white uppercase tracking-widest">Contact Support</h4>

                  {contactSubmitStatus === 'success' ? (
                    <div className="py-10 text-center space-y-4 bg-green-500/5 border border-green-500/10 rounded-2xl animate-in zoom-in-95 duration-300">
                      <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-green-400">Message Sent</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">We will get back to you shortly.</p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleContactSubmit} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[8px] font-black uppercase tracking-widest text-slate-600 ml-1">Name</label>
                          <input
                            type="text"
                            placeholder="Your Name"
                            value={contactName}
                            onChange={(e) => setContactName(e.target.value)}
                            className="w-full h-10 bg-black/40 border border-white/5 rounded-xl px-4 text-xs text-white outline-none focus:border-[var(--accent)]/50 transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[8px] font-black uppercase tracking-widest text-slate-600 ml-1">Email</label>
                          <input
                            type="email"
                            required
                            placeholder="your@email.com"
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            className="w-full h-10 bg-black/40 border border-white/5 rounded-xl px-4 text-xs text-white outline-none focus:border-[var(--accent)]/50 transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black uppercase tracking-widest text-slate-600 ml-1">Message</label>
                        <textarea
                          required
                          value={contactMessage}
                          onChange={(e) => setContactMessage(e.target.value)}
                          placeholder="How can we help?"
                          className="w-full h-24 bg-black/40 border border-white/5 rounded-xl p-4 text-xs text-white outline-none focus:border-[var(--accent)]/50 transition-all resize-none"
                        />
                      </div>

                      {contactSubmitStatus === 'error' && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-black uppercase tracking-widest text-center">
                          Failed to send message. Please try again.
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isContactSubmitting || !contactMessage.trim()}
                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-black uppercase text-[10px] tracking-[0.1em] transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10"
                      >
                        {isContactSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Send Message</>}
                      </button>
                    </form>
                  )}

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Support Email</span>
                      <span className="text-[9px] font-bold text-[var(--accent-secondary)]">{import.meta.env.VITE_CONTACT_EMAIL || 'anasbassoumi@gmail.com'}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">System Online</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-10 pt-8 border-t border-white/5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <CircleHelp className="w-5 h-5" />
              </div>
              <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500 leading-relaxed">
                Version {import.meta.env.VITE_APP_VERSION || '10.0.4'} <br /> Stable release.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Toolbar;