import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useModalStore } from '../../store/useModalStore';
import { useAuthStore } from '../../store/useAuthStore';
import { PLAN_CONFIG, type SubscriptionPlan } from '../../constants';

// Modular Components
import { SpaceSwitcher } from './SpaceSwitcher';
import { FilterPanel } from './FilterPanel';
import { ViewSwitcher } from './ViewSwitcher';
import { ActionFAB } from './ActionFAB';
import { SystemTray } from './SystemTray';
import { StatusBar } from './StatusBar';
import { ShortcutsModal, HelpModal, SettingsModal } from './Modals';
import { AccountMenu } from './AccountMenu';

const Toolbar: React.FC = () => {
  const activeSpaceId = useStore((state) => state.activeSpaceId);

  const spaces = useStore((state) => state.spaces);
  const thoughts = useStore((state) => state.thoughts);
  const setActiveSpace = useStore((state) => state.setActiveSpace);
  const addThought = useStore((state) => state.addThought);
  const updateSpace = useStore((state) => state.updateSpace);
  const deleteSpace = useStore((state) => state.deleteSpace);
  const addSpace = useStore((state) => state.addSpace);
  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  const exportData = useStore((state) => state.exportData);
  const importData = useStore((state) => state.importData);
  const customBg = useStore((state) => state.customBg);
  const customBgLoading = useStore((state) => state.customBgLoading);
  const setCustomBg = useStore((state) => state.setCustomBg);
  const physicsIntensity = useStore((state) => state.physicsIntensity);
  const setPhysicsIntensity = useStore((state) => state.setPhysicsIntensity);
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

  const { openModal } = useModalStore();

  const setTransform = useStore((state) => state.setTransform);

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const [isSpaceMenuOpen, setIsSpaceMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState<'about' | 'issue' | 'contact'>('about');

  // Expose modal triggers to window for cross-modal navigation
  useEffect(() => {
    (window as any)._openShortcuts = () => setIsShortcutsOpen(true);
    (window as any)._openHelp = () => setIsHelpOpen(true);
    (window as any)._openSettings = () => setIsSettingsOpen(true);
    return () => {
      delete (window as any)._openShortcuts;
      delete (window as any)._openHelp;
      delete (window as any)._openSettings;
    };
  }, []);

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

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isSpaceMenuOpen && !target.closest('.space-switcher-container')) setIsSpaceMenuOpen(false);
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, [isSpaceMenuOpen]);

  const handleExport = () => { exportData(); };
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
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleAddThought = async () => {
    if (isReadOnly) return;
    if (thoughts.length >= limits.MAX_THOUGHTS_PER_SPACE) {
      const isPro = user?.plan === 'pro';
      openModal({
        title: isPro ? 'Space Limit Reached' : 'Thinking Limit Reached',
        description: isPro 
          ? `You’ve reached the pro limit of ${limits.MAX_THOUGHTS_PER_SPACE} thoughts for this space. Need more capacity? Contact us for specialized plans.` 
          : `You’ve reached the free limit of ${limits.MAX_THOUGHTS_PER_SPACE} thoughts for this space. Upgrade to Cyberia Pro to unlock unlimited mapping and premium Oracle AI features.`,
        type: 'limit_thought', 
        confirmText: isPro ? 'Acknowledged' : 'Upgrade to Pro', 
        onConfirm: isPro ? undefined : () => window.location.href = '/pricing'
      });
      return;
    }

    // Use current hover context for placement if available
    const hoverContext = (window as any)._cyberia_hover_context || {};
    const id = await addThought({
      x: hoverContext.x,
      y: hoverContext.y,
      status: hoverContext.status,
      startTime: hoverContext.startTime,
      endTime: hoverContext.startTime,
      isAllDay: hoverContext.startTime ? true : false
    });
    
    if (id !== '') { setSelectedThoughtId(id); setInspectorOpen(true); useStore.getState().setInspectorTitleFocusId(id); }
  };

  const setViewMode = (mode: 'spatial' | 'kanban' | 'calendar' | 'directory') => {
    if (!activeSpace) return;
    if (mode !== 'spatial') setTransform({ x: 0, y: 0, scale: 1 });
    else if (activeSpace.mode !== 'spatial') setTransform({ x: activeSpace.transformX ?? 0, y: activeSpace.transformY ?? 0, scale: activeSpace.transformScale ?? 1 });
    updateSpace(activeSpace.id, { mode });
  };

  const handleRenameSpace = () => activeSpace && (openModal({ title: 'Rename Space', type: 'rename', inputValue: activeSpace.name, confirmText: 'Rename', onConfirm: (n) => n && updateSpace(activeSpace.id, { name: (n as string).substring(0, 15) }) }), setIsSpaceMenuOpen(false));
  const handleCreateSpace = () => {
    if (spaces.length >= limits.MAX_SPACES) {
      const isPro = user?.plan === 'pro';
      openModal({ 
        title: 'Space Limit Reached', 
        description: isPro 
          ? `You’ve reached the pro limit of ${limits.MAX_SPACES} spaces. Contact us if you need higher space capacity.` 
          : `You’ve reached the free limit of ${limits.MAX_SPACES} spaces. Upgrade to Cyberia Pro to create more spaces and unlock premium features.`, 
        type: 'limit_space', 
        confirmText: isPro ? 'Acknowledged' : 'Upgrade to Pro', 
        onConfirm: isPro ? undefined : () => window.location.href = '/pricing' 
      });
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

  return (
    <>
      <div className="fixed top-2 md:top-6 left-4 md:left-8 right-4 md:right-8 z-[9999] flex items-center justify-between gap-2 pointer-events-none">
        {/* Left Side: Space Switcher & Filters */}
        <div className="flex-1 flex justify-start items-center gap-3 pointer-events-auto">
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
            handleDeleteSpace={handleDeleteSpace}
          />
          <FilterPanel />
        </div>

        {/* Right Side: Account Menu */}
        <div className="flex-1 flex justify-end items-center gap-3 pointer-events-auto">
          <AccountMenu />
        </div>
      </div>

      {/* Center: View Switcher */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] pointer-events-auto">
        <ViewSwitcher activeSpace={activeSpace} setViewMode={setViewMode} />
      </div>
      
      <ActionFAB 
        isReadOnly={isReadOnly} 
        handleAddThought={handleAddThought} 
        isDraggingThought={useStore((state) => state.isDraggingThought)} 
        isOverDeleteZone={useStore((state) => state.isOverDeleteZone)} 
      />
      
      <SystemTray 
        isShortcutsOpen={isShortcutsOpen} 
        setIsShortcutsOpen={setIsShortcutsOpen} 
        isHelpOpen={isHelpOpen} 
        setIsHelpOpen={setIsHelpOpen} 
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
      />

      <StatusBar 
        thoughtsCount={thoughts.length} 
        limits={limits} 
        activeSpace={activeSpace} 
        undo={undo} 
        redo={redo} 
        historyIndex={historyIndex} 
        historyLength={history.length} 
        zoomIn={zoomIn} 
        zoomOut={zoomOut} 
        resetTransform={resetTransform}
        physicsIntensity={physicsIntensity}
        setPhysicsIntensity={setPhysicsIntensity}
      />

      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
      
      <HelpModal 
        isOpen={isHelpOpen} 
        onClose={() => setIsHelpOpen(false)} 
        activeTab={activeHelpTab} 
        setActiveTab={setActiveHelpTab} 
        quickMessage={quickMessage} 
        setQuickMessage={setQuickMessage} 
        quickType={quickType} 
        setQuickType={setQuickType} 
        isQuickSubmitting={isQuickSubmitting} 
        quickSubmitStatus={quickSubmitStatus} 
        handleQuickSubmit={handleQuickSubmit} 
        contactName={contactName} 
        setContactName={setContactName} 
        contactEmail={contactEmail} 
        setContactEmail={setContactEmail} 
        contactMessage={contactMessage} 
        setContactMessage={setContactMessage} 
        isContactSubmitting={isContactSubmitting} 
        contactSubmitStatus={contactSubmitStatus} 
        handleContactSubmit={handleContactSubmit} 
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        customBg={customBg}
        customBgLoading={customBgLoading}
        setCustomBg={setCustomBg}
        handleExport={handleExport}
        handleImport={handleImport}
        deferredPrompt={deferredPrompt}
        handleInstall={handleInstall}
      />
    </>
  );
};

export default Toolbar;
