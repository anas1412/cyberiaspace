import { useEffect, useRef, Suspense, lazy, useState } from 'react';
import { isBrowser } from 'react-device-detect';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useStore } from './store/useStore';
import { getSetting, setSetting } from './utils/settings';
import { detectImageType, generateThumbnail } from './utils/image';
import { stripFileExtension } from './utils/file';
import Viewport from './components/Viewport';
import Toolbar from './components/toolbar/Toolbar';
import AIToggleButton from './components/toolbar/AIToggleButton';
import BackgroundEngine from './components/background/BackgroundEngine';
import MultiSelectionMenu from './components/MultiSelectionMenu';
import EmptyState from './components/EmptyState';
import Modal from './components/Modal';
import Lightbox from './components/Lightbox';
import LoadingOverlay from './components/LoadingOverlay';
import UpdateToast from './components/UpdateToast';
import ExternalScripts from './components/ExternalScripts';
import { fetchEmbedMeta } from './utils/embeds';

// Lazy Loaded Components
const KanbanOverlay = lazy(() => import('./components/KanbanOverlay'));
const CalendarOverlay = lazy(() => import('./components/CalendarOverlay'));
const DirectoryOverlay = lazy(() => import('./components/DirectoryOverlay'));
const ChatOverlay = lazy(() => import('./components/ChatOverlay'));
const Inspector = lazy(() => import('./components/Inspector'));
const FocusEditor = lazy(() => import('./components/editors/FocusEditor'));
const PrivacyPolicy = lazy(() => import('./components/legal/PrivacyPolicy'));
const Terms = lazy(() => import('./components/legal/Terms'));
const LegalNotice = lazy(() => import('./components/legal/LegalNotice'));
const Homepage = lazy(() => import('./components/Homepage'));
const MobilePage = lazy(() => import('./components/MobilePage'));
const NotFound = lazy(() => import('./components/NotFound'));

function App() {
  // ========== ALL HOOKS AT TOP ==========

  const init = useStore((state) => state.init);
  const setDeferredPrompt = useStore((state) => state.setDeferredPrompt);
  const thoughts = useStore((state) => state.thoughts);
  const addThought = useStore((state) => state.addThought);
  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);

  const mouseWorldPos = useRef({ x: 0, y: 0 });
  const mouseScreenPos = useRef({ x: 0, y: 0 });

  const [path, setPath] = useState(window.location.pathname);

  // Hook: Body class
  useEffect(() => {
    const isAppPath = path.startsWith('/home');
    if (isAppPath) {
      document.body.classList.add('app-body');
    } else {
      document.body.classList.remove('app-body');
    }
  }, [path]);

  const theme = useStore((state) => state.theme);

  useEffect(() => {
    // Clean up preloader inline styles so CSS [data-theme] selectors work fully
    const root = document.documentElement;
    root.style.removeProperty('--bg-page');
    root.style.removeProperty('--text-primary');
    root.style.removeProperty('--accent');
    root.style.removeProperty('--glass-border');
    root.style.removeProperty('--bg-ambient');
    root.style.removeProperty('--node-bg');

    root.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    setSetting('theme', theme);

    const customNodeBg = getSetting('node-bg');
    if (customNodeBg) {
      document.documentElement.style.setProperty('--node-bg', customNodeBg, 'important');
    } else {
      const defaultNodeBg = theme === 'dark' ? '#12121af5' : '#f8fafc';
      document.documentElement.style.setProperty('--node-bg', defaultNodeBg, 'important');
    }
  }, [theme]);

  // Hook: Popstate
  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Hook: Mouse move
  useEffect(() => {
    const getGlobalScale = () => {
      const body = document.querySelector('.app-body') || document.body;
      const style = window.getComputedStyle(body);
      const m = new DOMMatrix(style.transform);
      return m.a || 1;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const s = getGlobalScale();
      const lx = e.clientX / s;
      const ly = e.clientY / s;

      mouseScreenPos.current = { x: lx, y: ly };
      const activeSpace = useStore.getState().spaces.find(s => s.id === useStore.getState().activeSpaceId);

      if (activeSpace?.mode === 'spatial') {
        const tx = activeSpace.transformX ?? 0;
        const ty = activeSpace.transformY ?? 0;
        const scale = activeSpace.transformScale ?? 1;
        mouseWorldPos.current = {
          x: (lx - tx) / scale,
          y: (ly - ty) / scale
        };
      } else {
        mouseWorldPos.current = { x: lx, y: ly };
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Hook: Init and PWA
  useEffect(() => {
    if (path.startsWith('/home')) {
      init();
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [init, setDeferredPrompt, path]);

  // Hook: Paste
  useEffect(() => {
    const getPlacementProps = () => {
      const activeSpace = spaces.find(s => s.id === activeSpaceId);
      // Use Viewport's live camera-based world position (accurate on every frame)
      // instead of App's stale transformX/Y/Space transform (500ms debounced)
      const hoverContext = (window as any)._cyberia_hover_context;
      const props: any = {
        x: hoverContext?.x ?? mouseWorldPos.current.x,
        y: hoverContext?.y ?? mouseWorldPos.current.y
      };

      if (activeSpace?.mode === 'kanban') {
        const x = mouseScreenPos.current.x;
        const width = window.innerWidth;
        if (x < width * 0.25) props.status = 'none';
        else if (x < width * 0.50) props.status = 'todo';
        else if (x < width * 0.75) props.status = 'doing';
        else props.status = 'done';
      } else if (activeSpace?.mode === 'calendar') {
        const elements = document.elementsFromPoint(mouseScreenPos.current.x, mouseScreenPos.current.y);
        const cell = elements.find(el => (el as HTMLElement).classList.contains('cal-cell'));
        if (cell) {
          const dateStr = (cell as HTMLElement).dataset.date;
          if (dateStr) {
            const time = new Date(dateStr).getTime();
            props.startTime = time;
            props.endTime = time;
            props.isAllDay = true;
          }
        }
      }
      return props;
    };

    const processPasteData = async (clipboardData: DataTransfer | null, textFallback?: string) => {
      if (clipboardData) {
        const items = clipboardData.items;
        let bestFile: File | null = null;
        let htmlContent: string | null = null;
        const priority = ['image/gif', 'image/webp', 'image/png', 'image/jpeg'];

        for (let i = 0; i < items.length; i++) {
          if (items[i].type === 'text/html') {
            htmlContent = clipboardData.getData('text/html');
          }

          if (items[i].type.startsWith('image/')) {
            const file = items[i].getAsFile();
            if (file) {
              const actualType = await detectImageType(file);
              if (!bestFile || priority.indexOf(actualType) < priority.indexOf(bestFile.type)) {
                if (actualType !== file.type) {
                  bestFile = new File([file], file.name, { type: actualType });
                } else {
                  bestFile = file;
                }
              }
            }
          }
        }

        if (htmlContent && (!bestFile || bestFile.type !== 'image/gif')) {
          const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
          const img = doc.querySelector('img');
          const src = img?.getAttribute('src');
          if (src && (src.toLowerCase().includes('.gif') || src.startsWith('data:image/gif'))) {
            try {
              const response = await fetch(src);
              const blob = await response.blob();
              const fileName = src.split('/').pop()?.split('?')[0] || 'recovered_animation.gif';
              bestFile = new File([blob], fileName, { type: 'image/gif' });
            } catch (e) {
              console.warn('[Paste] Failed to recover original GIF animation:', e);
            }
          }
        }

        if (bestFile) {
          const actualType = bestFile.type;
          const extension = actualType.split('/')[1] || 'png';
          const fileName = bestFile.name || `pasted_image.${extension}`;

          const thumbnail = await generateThumbnail(bestFile).catch(() => null);
          const id = await addThought({
            ...getPlacementProps(),
            type: 'file',
            text: stripFileExtension(fileName),
            data: {
              type: 'file',
              url: thumbnail || '',
              name: fileName,
              size: bestFile.size,
              meta: {
                name: fileName,
                size: bestFile.size,
                type: actualType
              } as any
            },
            meta: {
              file: {
                name: fileName,
                size: bestFile.size,
                type: actualType
              }
            }
          });

          if (id !== '') {
            const { db } = await import('./db');
            await db.blobs.put({
              id: id,
              thoughtId: id,
              blob: bestFile,
              name: fileName,
              type: actualType,
              updatedAt: Date.now()
            });

            setSelectedThoughtId(id);
          }
          return;
        }
      }

      const text = clipboardData ? clipboardData.getData('text') : textFallback;
      if (text && text.trim()) {
        const cleanText = text.trim();
        const isUrl = /^https?:\/\/[^\s]+$/i.test(cleanText);

        if (isUrl) {
          const id = await addThought({
            ...getPlacementProps(),
            type: 'embed',
            text: "Loading Link...",
            data: { type: 'embed', url: cleanText }
          });

          if (id !== '') {
            setSelectedThoughtId(id);
            fetchEmbedMeta(cleanText)
              .then(metadata => {
                if (metadata) {
                  useStore.getState().updateThought(id, {
                    text: metadata.title || "Link",
                    author: metadata.author_name || "",
                    description: metadata.description || "",
                    data: {
                      type: 'embed',
                      url: cleanText,
                      provider: metadata.provider_name,
                    },
                    meta: metadata
                  });
                }
              })
              .catch(() => {
                useStore.getState().updateThought(id, { text: "Link" });
              });
          }
          return;
        }

        const id = await addThought({
          ...getPlacementProps(),
          type: 'text',
          text: "Note",
          data: { type: 'text', content: cleanText }
        });
        if (id !== '') {
          setSelectedThoughtId(id);
          setInspectorOpen(true);
          useStore.getState().setInspectorTitleFocusId(id);
        }
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;
      processPasteData(e.clipboardData);
    };

    const handleCustomPaste = (event: any) => {
      const { dataTransfer, text } = event.detail;
      processPasteData(dataTransfer || null, text);
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('cyberia-paste-triggered', handleCustomPaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('cyberia-paste-triggered', handleCustomPaste);
    };
  }, [addThought, setSelectedThoughtId, setInspectorOpen, thoughts.length, path, spaces, activeSpaceId]);

  // ========== RENDER BASED ON PATH ==========

  if (path === '/') {
    return (
      <Suspense fallback={<LoadingOverlay force />}>
        <Homepage />
        <Modal />
      </Suspense>
    );
  }

  if (path === '/privacy') {
    return (
      <Suspense fallback={<LoadingOverlay force />}>
        <PrivacyPolicy />
      </Suspense>
    );
  }

  if (path === '/terms') {
    return (
      <Suspense fallback={<LoadingOverlay force />}>
        <Terms />
      </Suspense>
    );
  }

  if (path === '/legal') {
    return (
      <Suspense fallback={<LoadingOverlay force />}>
        <LegalNotice />
      </Suspense>
    );
  }

  // Main Workspace logic for /home
  const isWorkspacePath = path.startsWith('/home');
  if (isWorkspacePath) {
    if (!isBrowser) {
      return (
        <Suspense fallback={<LoadingOverlay force />}>
          <MobilePage />
        </Suspense>
      );
    }

    return (
      <main className="w-full h-full relative overflow-hidden app-body">
        <BackgroundEngine />
        <LoadingOverlay />

        <Suspense fallback={<LoadingOverlay force />}>
          <Viewport />
          <EmptyState />
          <KanbanOverlay />
          <CalendarOverlay />
          <DirectoryOverlay />
          <Toolbar />
          <AIToggleButton />
          <Inspector />
          <MultiSelectionMenu />
          <ChatOverlay />
          <Modal />
          <Lightbox />
          <FocusEditor />
          <UpdateToast />
          <ExternalScripts />
        </Suspense>
        <Analytics />
        <SpeedInsights />
      </main>
    );
  }

  return (
    <Suspense fallback={<LoadingOverlay force />}>
      <NotFound />
    </Suspense>
  );
}

export default App;
