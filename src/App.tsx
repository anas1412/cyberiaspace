import { useEffect, useRef, Suspense, lazy, useState } from 'react';
import { isBrowser } from 'react-device-detect';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useStore } from './store/useStore';
import { useModalStore } from './store/useModalStore';
import { useAuthStore } from './store/useAuthStore';
import { PLAN_CONFIG } from './constants';
import { detectImageType, generateThumbnail } from './utils/image';
import Viewport from './components/Viewport';
import Toolbar from './components/toolbar/Toolbar';
import MultiSelectionMenu from './components/MultiSelectionMenu';
import EmptyState from './components/EmptyState';
import Modal from './components/Modal';
import PricingModal from './components/PricingModal';
import Lightbox from './components/Lightbox';
import LoadingOverlay from './components/LoadingOverlay';
import UpdateToast from './components/UpdateToast';
import ExternalScripts from './components/ExternalScripts';
import { fetchEmbedMeta } from './utils/embeds';

// Lazy Loaded Components
const KanbanOverlay = lazy(() => import('./components/KanbanOverlay'));
const CalendarOverlay = lazy(() => import('./components/CalendarOverlay'));
const ChatOverlay = lazy(() => import('./components/ChatOverlay'));
const Inspector = lazy(() => import('./components/Inspector'));
const TextFocusEditor = lazy(() => import('./components/editors/TextFocusEditor'));
const TableFocusEditor = lazy(() => import('./components/editors/TableFocusEditor'));
const PaintFocusEditor = lazy(() => import('./components/editors/PaintFocusEditor'));
const TasksFocusEditor = lazy(() => import('./components/editors/TasksFocusEditor'));
const EmbedFocusEditor = lazy(() => import('./components/editors/EmbedFocusEditor'));
const FileFocusEditor = lazy(() => import('./components/editors/FileFocusEditor'));
const FeedbackPage = lazy(() => import('./components/FeedbackPage'));
const PrivacyPolicy = lazy(() => import('./components/legal/PrivacyPolicy'));
const CGV = lazy(() => import('./components/legal/CGV'));
const LegalNotice = lazy(() => import('./components/legal/LegalNotice'));
const Contact = lazy(() => import('./components/legal/Contact'));
const LoginPage = lazy(() => import('./components/auth/LoginPage'));
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
  const theme = useStore((state) => state.theme);
  const performanceMode = useStore((state) => state.performanceMode);
  const customBg = useStore((state) => state.customBg);

  const { isPricingOpen, closePricing, openModal } = useModalStore();
  
  const mouseWorldPos = useRef({ x: 0, y: 0 });
  const mouseScreenPos = useRef({ x: 0, y: 0 });
  
  const [path, setPath] = useState(window.location.pathname);
  const [staticBg, setStaticBg] = useState<string | null>(null);

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isMainDomain = hostname === 'cyberia.tn' || hostname === 'www.cyberia.tn';
  const isApp = hostname === 'app.cyberia.tn' || hostname === 'localhost' || hostname === '127.0.0.1';

  // Hook: Remove PWA manifest on non-app domains
  useEffect(() => {
    if (!isApp) {
      const manifest = document.querySelector('link[rel="manifest"]');
      if (manifest) manifest.remove();
    }
  }, [isApp]);

  // Hook: Body class
  useEffect(() => {
    if (!isMainDomain && (path === '/' || path.startsWith('/s/') || path === '/pricing')) {
      document.body.classList.add('app-body');
    } else {
      document.body.classList.remove('app-body');
    }
    return () => document.body.classList.remove('app-body');
  }, [path, isMainDomain]);

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
    const hostname = window.location.hostname;
    const isMainDomain = hostname === 'cyberia.tn' || hostname === 'www.cyberia.tn';

    if ((path === '/' || path.startsWith('/s/') || path === '/pricing') && !isMainDomain) {
      init();
      if (path === '/pricing') {
        useModalStore.getState().openPricing();
      }
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
      const props: any = {
        x: mouseWorldPos.current.x,
        y: mouseWorldPos.current.y
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
          props.date = (cell as HTMLElement).dataset.date;
        }
      }
      return props;
    };

    const processPasteData = async (clipboardData: DataTransfer | null, textFallback?: string) => {
      const authStore = useAuthStore.getState();
      const currentLimits = PLAN_CONFIG[authStore.user?.plan || 'free'];
      if (thoughts.length >= currentLimits.MAX_THOUGHTS_PER_SPACE) {
        openModal({
          title: 'Thinking Limit Reached',
          description: `You’ve reached the free limit of ${currentLimits.MAX_THOUGHTS_PER_SPACE} thoughts for this space. Upgrade to Cyberia Pro to unlock unlimited mapping and premium Oracle AI features.`,
          type: 'limit_thought',
          confirmText: 'Upgrade to Pro',
          onConfirm: () => useModalStore.getState().openPricing()
        });
        return;
      }

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
            type: 'file', // Consolidated to 'file'
            text: fileName,
            data: {
              type: 'file', // Consolidated to 'file'
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
              id: id, // Deterministic ID
              thoughtId: id,
              blob: bestFile,
              name: fileName,
              type: actualType,
              updatedAt: Date.now()
            });
            
            setSelectedThoughtId(id);
            useAuthStore.getState().uploadThoughtBlob(id);
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
                    image: metadata.thumbnail_url || null,
                    data: {
                      type: 'embed',
                      url: cleanText,
                      provider: metadata.provider_name,
                      // Note: thumbnail_url is not in embed payload but we keep it in meta if needed
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
        }
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;
      processPasteData(e.clipboardData);
    };

    const handleCustomPaste = (e: any) => {
      const { dataTransfer, text } = e.detail;
      processPasteData(dataTransfer || null, text);
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('cyberia-paste-triggered', handleCustomPaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('cyberia-paste-triggered', handleCustomPaste);
    };
  }, [addThought, setSelectedThoughtId, setInspectorOpen, thoughts.length, openModal, path, spaces, activeSpaceId]);

  // Hook: Static background
  useEffect(() => {
    if (performanceMode && customBg && (customBg.includes('image/gif') || customBg.toLowerCase().endsWith('.gif'))) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = customBg;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            setStaticBg(canvas.toDataURL('image/webp', 0.8));
          } catch (e) {
            setStaticBg(null);
          }
        }
      };
    } else {
      setStaticBg(null);
    }
  }, [performanceMode, customBg]);

  // Landing page is only available on main domain or localhost (for dev)
  const canSeeLanding = isMainDomain || hostname === 'localhost' || hostname === '127.0.0.1';

  // ========== RENDER BASED ON PATH ==========
  
  if (path === '/home' && canSeeLanding) {
    return (
      <Suspense fallback={<LoadingOverlay force />}>
        <Homepage />
      </Suspense>
    );
  }

  if (path === '/feedback') {
    return (
      <Suspense fallback={<LoadingOverlay force />}>
        <FeedbackPage />
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

  if (path === '/cgv') {
    return (
      <Suspense fallback={<LoadingOverlay force />}>
        <CGV />
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

  if (path === '/contact') {
    return (
      <Suspense fallback={<LoadingOverlay force />}>
        <Contact />
      </Suspense>
    );
  }

  if (path === '/login') {
    return (
      <Suspense fallback={<LoadingOverlay force />}>
        <LoginPage />
      </Suspense>
    );
  }

  if (path === '/pricing') {
    // If we're on /pricing, we stay on the app root but open the pricing modal
  }

  // Landing page routes - only on main domain
  if (isMainDomain) {
    if (path === '/' || path === '/home') {
      return (
        <Suspense fallback={<LoadingOverlay force />}>
          <Homepage />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<LoadingOverlay force />}>
        <NotFound />
      </Suspense>
    );
  }

  // App domain: check for valid routes, otherwise show NotFound
  const validAppRoutes = ['/feedback', '/privacy', '/cgv', '/legal', '/contact', '/login', '/pricing'];
  const isValidAppRoute = path === '/' || path.startsWith('/s/') || validAppRoutes.includes(path) || (path === '/home' && canSeeLanding);
  
  if (!isValidAppRoute) {
    return (
      <Suspense fallback={<LoadingOverlay force />}>
        <NotFound />
      </Suspense>
    );
  }

  // Guard: Mobile/Tablet access to workspace
  const isWorkspacePath = path === '/' || path.startsWith('/s/');
  if (!isBrowser && isWorkspacePath && !isMainDomain) {
    return (
      <Suspense fallback={<LoadingOverlay force />}>
        <MobilePage />
      </Suspense>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-black">
      {customBg && (
        <div 
          className="custom-bg-layer transition-opacity duration-700 animate-in fade-in"
          style={{ backgroundImage: `url(${staticBg || customBg})`, opacity: 0.6 }}
        />
      )}

      {!performanceMode ? (
        <>
          <div className="fixed inset-0 z-[1] pointer-events-none transition-opacity duration-500" style={{ backgroundColor: customBg ? 'rgba(2, 4, 8, 0.2)' : 'transparent', mixBlendMode: customBg ? 'overlay' : 'normal' }} />
          {theme === 'cyberia' && <><div className="stars-layer stars-1" /><div className="stars-layer stars-2" /><div className="stars-layer stars-twinkle" /></>}
          {theme === 'sea' && <div className="sea-layer"><div className="sea-caustics" /><div className="bubbles-distant" /><div className="bubbles-near" /><div className="sea-silt" /></div>}
          {theme === 'forest' && <div className="forest-layer"><div className="forest-canopy" /><div className="god-rays" /><div className="fireflies-distant" /><div className="fireflies-near" /></div>}
          {theme === 'rain' && <div className="rain-layer"><div className="rain-drops" /><div className="rain-drops-fast" /><div className="thunder" /></div>}
          <div className="nebula-cloud" /><div className="grain" />
        </>
      ) : (
        <div className="fixed inset-0 z-[1] transition-colors duration-500" style={{ backgroundColor: theme === 'sea' ? '#000507' : theme === 'forest' ? '#020806' : theme === 'rain' ? '#0c0a09' : '#020408', opacity: customBg ? 0.8 : 1 }} />
      )}

      <Suspense fallback={null}>
        <Viewport />
        <EmptyState />
        <KanbanOverlay />
        <CalendarOverlay />
        <Toolbar />
        <Inspector />
        <MultiSelectionMenu />
        <ChatOverlay />
        <Modal />
        <PricingModal isOpen={isPricingOpen} onClose={closePricing} />
        <Lightbox />
        <TextFocusEditor />
        <TableFocusEditor />
        <PaintFocusEditor />
        <TasksFocusEditor />
        <EmbedFocusEditor />
        <FileFocusEditor />
        <LoadingOverlay />
        <UpdateToast />
        <ExternalScripts />
      </Suspense>
      <Analytics />
      <SpeedInsights />
    </div>
  );
}

export default App;
