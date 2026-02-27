import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useModalStore } from '../../store/useModalStore';
import { useAuthStore } from '../../store/useAuthStore';
import { PLAN_CONFIG, type SubscriptionPlan } from '../../constants';
import { toCanvas } from 'html-to-image';

// Modular Components
import { ToolbarLogo } from './ToolbarLogo';
import { SpaceSwitcher } from './SpaceSwitcher';
import { ViewSwitcher } from './ViewSwitcher';
import { ActionFAB } from './ActionFAB';
import { SystemTray } from './SystemTray';
import { StatusBar } from './StatusBar';
import { ShortcutsModal, HelpModal } from './Modals';

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
  const theme = useStore((state) => state.theme);

  const setTheme = useStore((state) => state.setTheme);
  const customBg = useStore((state) => state.customBg);
  const setCustomBg = useStore((state) => state.setCustomBg);
  const performanceMode = useStore((state) => state.performanceMode);
  const setPerformanceMode = useStore((state) => state.setPerformanceMode);
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
        body: JSON.stringify({ name: contactName, email: contactEmail, message: contactMessage })
      });
      if (res.ok) {
        setContactSubmitStatus('success');
        setContactMessage('');
        setTimeout(() => setContactSubmitStatus('idle'), 5000);
      } else setContactSubmitStatus('error');
    } catch { setContactSubmitStatus('error'); } finally { setIsContactSubmitting(false); }
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
        body: JSON.stringify({ message: quickMessage, email: user?.email || 'anonymous', type: quickType })
      });
      if (res.ok) {
        setQuickSubmitStatus('success');
        setQuickMessage('');
        setTimeout(() => setQuickSubmitStatus('idle'), 3000);
      } else setQuickSubmitStatus('error');
    } catch { setQuickSubmitStatus('error'); } finally { setIsQuickSubmitting(false); }
  };

  const lastUpdated = useStore((state) => state.lastUpdated);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isSystemMenuOpen && !target.closest('.system-tray-container')) setIsSystemMenuOpen(false);
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, [isSystemMenuOpen]);

  const handleExport = () => { exportData(); setIsSystemMenuOpen(false); };
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      openModal({
        title: 'Overwrite Current Data?',
        description: 'Importing will delete all your current spaces and thoughts. This cannot be undone.',
        type: 'import_confirm', confirmText: 'Import & Overwrite', onConfirm: () => importData(file)
      });
    }
    e.target.value = '';
    setIsSystemMenuOpen(false);
  };

  const handleScreenshot = async () => {
    const worldEl = document.getElementById('world');
    if (!worldEl || thoughts.length === 0) return;
    setIsCapturing(true);
    try {
      const body = document.querySelector('.app-body') || document.body;
      const globalScale = new DOMMatrix(window.getComputedStyle(body).transform).a || 1;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const worldRectRaw = worldEl.getBoundingClientRect();
      const worldRect = { left: worldRectRaw.left / globalScale, top: worldRectRaw.top / globalScale, width: worldRectRaw.width / globalScale, height: worldRectRaw.height / globalScale };
      const currentZoom = new DOMMatrix(window.getComputedStyle(worldEl).transform).a || 1;
      thoughts.forEach(t => {
        const el = document.querySelector(`.thought-bulb[data-id="${t.id}"]`) as HTMLElement;
        if (!el) return;
        const rectRaw = el.getBoundingClientRect();
        const rect = { left: rectRaw.left / globalScale, top: rectRaw.top / globalScale, width: rectRaw.width / globalScale, height: rectRaw.height / globalScale };
        const x = (rect.left - worldRect.left) / currentZoom;
        const y = (rect.top - worldRect.top) / currentZoom;
        const w = rect.width / currentZoom;
        const h = rect.height / currentZoom;
        if (x < minX) minX = x; if (y < minY) minY = y; if (x + w > maxX) maxX = x + w; if (y + h > maxY) maxY = y + h;
      });
      if (minX === Infinity) return;
      const padding = 60; const width = (maxX - minX) + (padding * 2); const height = (maxY - minY) + (padding * 2);
      const captureX = minX - padding; const captureY = minY - padding;
      const scaleFactor = Math.min(1, 4000 / Math.max(width, height));
      const canvas = await toCanvas(worldEl, {
        backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg-main').trim() || '#020408',
        cacheBust: true, pixelRatio: scaleFactor * 2, skipFonts: true,
        style: { transform: `translate(${-captureX}px, ${-captureY}px) scale(1)`, position: 'absolute', width: `${width}px`, height: `${height}px`, margin: '0', padding: '0', left: '0', top: '0', filter: 'none', backdropFilter: 'none', boxShadow: 'none' },
        width: Math.floor(width * scaleFactor), height: Math.floor(height * scaleFactor),
        filter: (node: HTMLElement) => !(node.classList?.contains('ui-layer') || node.id === 'connection-canvas' || (node.tagName === 'BUTTON' && !node.closest?.('.thought-bulb')))
      });
      const link = document.createElement('a');
      link.download = `cyberia_${activeSpace?.name || 'space'}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.85);
      document.body.appendChild(link); link.click();
      setTimeout(() => { if (document.body.contains(link)) document.body.removeChild(link); }, 100);
    } catch (error) {
      console.error('Screenshot failed:', error);
      openModal({ title: 'Screenshot Failed', description: 'The workspace might be too large or your device is out of memory.', type: 'alert', confirmText: 'Okay' });
    } finally { setIsCapturing(false); }
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
    setIsSystemMenuOpen(false);
  };

  const handleAddThought = async () => {
    if (isReadOnly) return;
    if (thoughts.length >= limits.MAX_THOUGHTS_PER_SPACE) {
      const isPro = user?.plan === 'pro';
      openModal({
        title: 'Space is Full', description: isPro ? `Capacity of ${limits.MAX_THOUGHTS_PER_SPACE} reached.` : `Reached Free limit of ${limits.MAX_THOUGHTS_PER_SPACE}.`,
        type: 'limit_thought', confirmText: isPro ? 'Okay' : 'Upgrade Now', onConfirm: isPro ? undefined : () => openPricing()
      });
      return;
    }
    const id = await addThought({});
    if (id !== -1) { setSelectedThoughtId(id); setInspectorOpen(true); }
  };

  const setViewMode = (mode: 'spatial' | 'kanban' | 'calendar') => {
    if (!activeSpace) return;
    if (mode !== 'spatial') setTransform({ x: 0, y: 0, scale: 1 });
    else if (activeSpace.mode !== 'spatial') setTransform({ x: activeSpace.transformX ?? 0, y: activeSpace.transformY ?? 0, scale: activeSpace.transformScale ?? 1 });
    updateSpace(activeSpace.id, { mode });
  };

  const handleTogglePhysics = () => activeSpace && updateSpace(activeSpace.id, { physics: !activeSpace.physics });
  const handleRenameSpace = () => activeSpace && (openModal({ title: 'Rename Space', type: 'rename', inputValue: activeSpace.name, confirmText: 'Rename', onConfirm: (n) => n && updateSpace(activeSpace.id, { name: (n as string).substring(0, 15) }) }), setIsSpaceMenuOpen(false));
  const handleCreateSpace = () => {
    if (spaces.length >= limits.MAX_SPACES) {
      const isPro = user?.plan === 'pro';
      openModal({ title: 'Limit Reached', description: isPro ? `Max limit of ${limits.MAX_SPACES} spaces reached.` : `Free plan limited to ${limits.MAX_SPACES} spaces.`, type: 'limit_space', confirmText: isPro ? 'Okay' : 'Upgrade Now', onConfirm: isPro ? undefined : () => openPricing() });
      return;
    }
    openModal({ title: 'Create New Space', type: 'new_space', confirmText: 'Create Space', onConfirm: (n) => addSpace(n && (n as string).trim() ? (n as string).substring(0, 15) : 'New Space') });
  };
  const handleDeleteSpace = () => {
    if (!activeSpace) return;
    if (spaces.length <= 1) { openModal({ title: 'Cannot Delete', description: 'At least 1 active space required.', type: 'alert', confirmText: 'Okay' }); return; }
    openModal({ title: `Delete "${activeSpace.name}"?`, description: 'This will delete all thoughts in this space.', type: 'delete_space', confirmText: 'Delete', onConfirm: () => deleteSpace(activeSpace.id) });
    setIsSpaceMenuOpen(false);
  };
  const handleMoveSpace = (dir: number) => {
    if (!activeSpace) return;
    const currentIndex = spaces.findIndex(s => s.id === activeSpaceId);
    const newIndex = currentIndex + dir;
    if (newIndex >= 0 && newIndex < spaces.length) {
      const newSpaces = [...spaces]; [newSpaces[currentIndex], newSpaces[newIndex]] = [newSpaces[newIndex], newSpaces[currentIndex]];
      reorderSpaces(newSpaces);
    }
  };

  return (
    <>
            <div className="fixed top-2 md:top-6 left-4 md:left-12 right-4 md:right-10 z-[9999] flex items-center justify-between gap-2 pointer-events-none">
              <ToolbarLogo />
              <SpaceSwitcher 
                spaces={spaces}
                activeSpaceId={activeSpaceId}
                setActiveSpace={setActiveSpace}
                isReadOnly={isReadOnly}
                isSpaceLoading={isSpaceLoading}
                creatorName={creatorName}
                lastUpdated={lastUpdated || null}
                activeSpace={activeSpace}
                isSpaceMenuOpen={isSpaceMenuOpen}
                setIsSpaceMenuOpen={setIsSpaceMenuOpen}
                limits={limits}
                handleCreateSpace={handleCreateSpace}
                handleRenameSpace={handleRenameSpace}
                handleMoveSpace={handleMoveSpace}
                handleDeleteSpace={handleDeleteSpace}
                openModal={openModal}
              />
        <ViewSwitcher activeSpace={activeSpace} setViewMode={setViewMode} />
      </div>
      <ActionFAB isReadOnly={isReadOnly} handleAddThought={handleAddThought} />
      <SystemTray 
        isReadOnly={isReadOnly} 
        user={user} 
        limits={limits} 
        isChatOpen={isChatOpen} 
        setChatOpen={setChatOpen} 
        openPricing={openPricing} 
        isShortcutsOpen={isShortcutsOpen} 
        setIsShortcutsOpen={setIsShortcutsOpen} 
        isHelpOpen={isHelpOpen} 
        setIsHelpOpen={setIsHelpOpen} 
        isSystemMenuOpen={isSystemMenuOpen} 
        setIsSystemMenuOpen={setIsSystemMenuOpen} 
        theme={theme} 
        setTheme={setTheme} 
        performanceMode={performanceMode}
        setPerformanceMode={setPerformanceMode}
        customBg={customBg}
        setCustomBg={setCustomBg}
        deferredPrompt={deferredPrompt} 
        handleInstall={handleInstall} 
        handleExport={handleExport} 
        handleScreenshot={handleScreenshot} 
        handleImport={handleImport} 
        isCapturing={isCapturing} 
        openModal={openModal} 
        activeSpace={activeSpace}
        handleTogglePhysics={handleTogglePhysics}
      />

      <StatusBar thoughtsCount={thoughts.length} limits={limits} activeSpace={activeSpace} undo={undo} redo={redo} historyIndex={historyIndex} historyLength={history.length} zoomIn={zoomIn} zoomOut={zoomOut} resetTransform={resetTransform} />
      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} activeTab={activeHelpTab} setActiveTab={setActiveHelpTab} quickMessage={quickMessage} setQuickMessage={setQuickMessage} quickType={quickType} setQuickType={setQuickType} isQuickSubmitting={isQuickSubmitting} quickSubmitStatus={quickSubmitStatus} handleQuickSubmit={handleQuickSubmit} contactName={contactName} setContactName={setContactName} contactEmail={contactEmail} setContactEmail={setContactEmail} contactMessage={contactMessage} setContactMessage={setContactMessage} isContactSubmitting={isContactSubmitting} contactSubmitStatus={contactSubmitStatus} handleContactSubmit={handleContactSubmit} />
    </>
  );
};

export default Toolbar;
