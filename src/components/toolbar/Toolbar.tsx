import React, { useState, useEffect } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useStore } from '../../store/useStore';
import { useModalStore } from '../../store/useModalStore';
import { useOverlayStore } from '../../store/useOverlayStore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Modular Components
import { SpaceSwitcher } from './SpaceSwitcher';
import { ViewSwitcher } from './ViewSwitcher';
import { ActionFAB } from './ActionFAB';
import { SystemTray } from './SystemTray';
import { StatusBar } from './StatusBar';
import { SearchOverlay } from './SearchOverlay';
import { ShortcutsModal, HelpModal, SettingsModal } from './Modals';
import { CustomizationModal } from './CustomizationModal';

const Toolbar: React.FC = () => {
  const activeSpaceId = useStore((state) => state.activeSpaceId);

  const spaces = useStore((state) => state.spaces);
  const setActiveSpace = useStore((state) => state.setActiveSpace);
  const addThought = useStore((state) => state.addThought);
  const updateSpace = useStore((state) => state.updateSpace);
  const deleteSpace = useStore((state) => state.deleteSpace);
  const addSpace = useStore((state) => state.addSpace);
  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  const exportData = useStore((state) => state.exportData);
  const importData = useStore((state) => state.importData);

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
  const customBg = useStore((state) => state.customBg);
  const customBgLoading = useStore((state) => state.customBgLoading);
  const customBgOpacity = useStore((state) => state.customBgOpacity);
  const setCustomBg = useStore((state) => state.setCustomBg);
  const setCustomBgOpacity = useStore((state) => state.setCustomBgOpacity);
  const isReadOnly = useStore((state) => state.isReadOnly);
  const creatorName = useStore((state) => state.creatorName);
  const isSpaceLoading = useStore((state) => state.isSpaceLoading);

  const { openModal } = useModalStore();

  const setTransform = useStore((state) => state.setTransform);

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const [isSpaceMenuOpen, setIsSpaceMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState<'about' | 'contact'>('about');

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

  // Sync overlay state for zoom/pan blocking
  useEffect(() => {
    const isAnyOpen = isSettingsOpen || isCustomizationOpen || isHelpOpen || isShortcutsOpen || isSearchOpen;
    useOverlayStore.getState().setOverlayOpen(isAnyOpen);
  }, [isSettingsOpen, isCustomizationOpen, isHelpOpen, isShortcutsOpen, isSearchOpen]);

  // Contact Form State
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);
  const [contactSubmitStatus, setContactSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

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
      <div className="fixed top-2 md:top-6 left-4 md:left-8 right-4 md:right-8 z-[var(--z-ui)] flex items-center justify-between gap-2 pointer-events-none">
        {/* Left: Space Identity */}
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
            handleCreateSpace={handleCreateSpace}
            handleRenameSpace={handleRenameSpace}
            handleDeleteSpace={handleDeleteSpace}
          />
        </div>

        {/* Center: View Switcher */}
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-auto">
          <ViewSwitcher activeSpace={activeSpace} setViewMode={setViewMode} />
        </div>

        {/* Right: Search Trigger */}
        <div className="flex-1 flex justify-end items-center gap-3 pointer-events-auto">
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            aria-label="Search"
            className={cn(
              "h-[44px] w-[44px] glass backdrop-blur-xl rounded-2xl border border-[var(--glass-border)] shadow-lg shadow-[var(--glass-border)] flex items-center justify-center transition-all",
              isSearchOpen
                ? "bg-[var(--glass-bg)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/30"
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>
        </div>
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
        isCustomizationOpen={isCustomizationOpen}
        setIsCustomizationOpen={setIsCustomizationOpen}
      />

      <StatusBar 
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
        handleExport={handleExport}
        handleImport={handleImport}
        deferredPrompt={deferredPrompt}
        handleInstall={handleInstall}
      />

      <CustomizationModal
        isOpen={isCustomizationOpen}
        onClose={() => setIsCustomizationOpen(false)}
        customBg={customBg}
        customBgLoading={customBgLoading}
        customBgOpacity={customBgOpacity}
        setCustomBg={setCustomBg}
        setCustomBgOpacity={setCustomBgOpacity}
      />

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
};

export default Toolbar;
