import React, { useEffect, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useStore } from './store/useStore';
import { useModalStore } from './store/useModalStore';
import { useAuthStore } from './store/useAuthStore';
import { PLAN_CONFIG, type SubscriptionPlan } from './constants';
import Viewport from './components/Viewport';
import Toolbar from './components/toolbar/Toolbar';
import Inspector from './components/Inspector';
import MultiSelectionMenu from './components/MultiSelectionMenu';
import EmptyState from './components/EmptyState';
import KanbanOverlay from './components/KanbanOverlay';
import CalendarOverlay from './components/CalendarOverlay';
import Modal from './components/Modal';
import PricingModal from './components/PricingModal';
import Lightbox from './components/Lightbox';

import TextFocusEditor from './components/editors/TextFocusEditor';
import TableFocusEditor from './components/editors/TableFocusEditor';
import PaintFocusEditor from './components/editors/PaintFocusEditor';
import TasksFocusEditor from './components/editors/TasksFocusEditor';
import EmbedFocusEditor from './components/editors/EmbedFocusEditor';
import ChatOverlay from './components/ChatOverlay';
import FeedbackPage from './components/FeedbackPage';
import LoadingOverlay from './components/LoadingOverlay';

import { fetchEmbedMeta } from './utils/embeds';

function App() {
  const init = useStore((state) => state.init);
  const setDeferredPrompt = useStore((state) => state.setDeferredPrompt);
  const thoughts = useStore((state) => state.thoughts);
  const addThought = useStore((state) => state.addThought);
  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);

  const { openModal, isPricingOpen, closePricing, openPricing } = useModalStore();
  const { user } = useAuthStore();
  const limits = (user?.plan && user.plan in PLAN_CONFIG) ? PLAN_CONFIG[user.plan as SubscriptionPlan] : PLAN_CONFIG.free;
  const mouseWorldPos = useRef({ x: 0, y: 0 });
  const mouseScreenPos = useRef({ x: 0, y: 0 });

  const [path, setPath] = React.useState(window.location.pathname);

  useEffect(() => {
    // Global Re-auth handler for 401 recovery
    (window as any)._cyberia_reauth = () => {
      // @ts-ignore
      if (window.google) {
        // @ts-ignore
        window.google.accounts.id.prompt();
      } else {
        // Fallback: Open system menu where sign-in is visible
        console.warn("Google SDK not ready, cannot trigger prompt.");
      }
    };
  }, []);

  useEffect(() => {
    if (path === '/') {
      document.body.classList.add('app-body');
    } else {
      document.body.classList.remove('app-body');
    }
    return () => document.body.classList.remove('app-body');
  }, [path]);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  useEffect(() => {
    // Only init DB if we are not on the feedback page
    if (path === '/' || path.startsWith('/s/')) {
      init();
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [init, setDeferredPrompt, path]);


  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (path !== '/' || useStore.getState().isReadOnly) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

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

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      // Deep Scan Logic: Browsers often hide the original animated GIF source in the HTML payload
      const html = clipboardData.getData('text/html');
      if (html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const img = doc.querySelector('img');
        const src = img?.getAttribute('src');

        if (src) {
          // More robust GIF detection (handles hex encoding like Wattpad's 2e676966, query params, and anchors)
          const isGif = /\.(gif|2e676966)($|\?|#|&)/i.test(src) ||
            src.includes('image/gif') ||
            src.includes('giphy.com') ||
            src.includes('tenor.com') ||
            src.toLowerCase().includes('/gif');

          const isImage = src.startsWith('data:image/') ||
            /\.(jpg|jpeg|png|webp|avif|svg)($|\?|#|&)/i.test(src) ||
            /2e(6a7067|706e67|77656270)/i.test(src); // Support hex for jpg, png, webp

          if (isGif || isImage) {
            e.preventDefault();
            const id = await addThought({
              ...getPlacementProps(),
              type: 'image',
              image: src,
              text: "Image"
            });
            if (id !== -1) {
              setSelectedThoughtId(id);
              setInspectorOpen(true);
            }
            return;
          }
        }
      }

      const items = Array.from(clipboardData.items);
      const gifItem = items.find(item => item.type === 'image/gif');
      const imageItem = gifItem || items.find(item => item.type.startsWith('image/'));

      if (imageItem) {
        const blob = imageItem.getAsFile();
        if (blob) {
          if (blob.size > 2 * 1024 * 1024) {
            openModal({
              title: 'File too Large',
              description: 'This image is larger than 2MB. Please use a smaller image to save space.',
              type: 'alert',
              confirmText: 'Okay'
            });
            return;
          }
          const reader = new FileReader();
          reader.onload = async (event) => {
            const id = await addThought({
              ...getPlacementProps(),
              type: 'image',
              image: event.target?.result as string,
              text: "Image"
            });
            if (id !== -1) {
              setSelectedThoughtId(id);
              setInspectorOpen(true);
            }
          };
          reader.readAsDataURL(blob);
          e.preventDefault();
          return;
        }
      }

      // Priority 3: Text
      const text = clipboardData.getData('text');
      if (text && text.trim()) {
        const cleanText = text.trim();
        const isUrl = /^https?:\/\/[^\s]+$/i.test(cleanText);

        if (isUrl) {
          e.preventDefault();

          const id = await addThought({
            ...getPlacementProps(),
            type: 'embed',
            text: "Loading Link...",
            content: cleanText
          });

          if (id !== -1) {
            setSelectedThoughtId(id);

            fetchEmbedMeta(cleanText)
              .then(metadata => {
                if (metadata) {
                  useStore.getState().updateThought(id, {
                    text: metadata.title || "Link",
                    author: metadata.author_name || "",
                    description: metadata.description || "",
                    image: metadata.thumbnail_url || null,
                    meta: metadata
                  });
                }
              })
              .catch(err => {
                console.warn("Embed metadata fetch failed:", err);
                useStore.getState().updateThought(id, { text: "Link" });
              });
          }
          return;
        }

        e.preventDefault();
        const id = await addThought({
          ...getPlacementProps(),
          type: 'text',
          text: "Note",
          content: cleanText
        });
        if (id !== -1) {
          setSelectedThoughtId(id);
          setInspectorOpen(true);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addThought, setSelectedThoughtId, setInspectorOpen, thoughts.length, openModal, path, limits.MAX_THOUGHTS_PER_SPACE]);

  const theme = useStore((state) => state.theme);
  const performanceMode = useStore((state) => state.performanceMode);
  const customBg = useStore((state) => state.customBg);
  const [staticBg, setStaticBg] = React.useState<string | null>(null);

  // Performance Optimization: Freeze GIFs in Performance Mode
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
            console.warn("Could not freeze GIF due to CORS, falling back to original.");
            setStaticBg(null);
          }
        }
      };
    } else {
      setStaticBg(null);
    }
  }, [performanceMode, customBg]);

  if (path === '/feedback') {
    return (
      <>
        <FeedbackPage />
        <Modal />
      </>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-black">
      {/* Custom Background Base Layer */}
      {customBg && (
        <div 
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 animate-in fade-in"
          style={{ 
            backgroundImage: `url(${staticBg || customBg})`,
            opacity: 0.6 // Consistent reduced opacity for both modes
          }}
        />
      )}

      {!performanceMode ? (
        <>
          {/* Theme-Specific Background Layers - Use semi-transparent overlay if customBg exists */}
          <div 
            className="fixed inset-0 z-[1] pointer-events-none transition-opacity duration-500"
            style={{ 
              backgroundColor: customBg ? 'rgba(2, 4, 8, 0.2)' : 'transparent',
              mixBlendMode: customBg ? 'overlay' : 'normal'
            }}
          />
          
          {theme === 'cyberia' && (
            <>
              <div className="stars-layer stars-1" />
              <div className="stars-layer stars-2" />
              <div className="stars-layer stars-twinkle" />
            </>
          )}

          {theme === 'sea' && (
            <div className="sea-layer">
              <div className="sea-caustics" />
              <div className="bubbles-distant" />
              <div className="bubbles-near" />
              <div className="sea-silt" />
            </div>
          )}

          {theme === 'forest' && (
            <div className="forest-layer">
              <div className="forest-canopy" />
              <div className="god-rays" />
              <div className="fireflies-distant" />
              <div className="fireflies-near" />
            </div>
          )}

          {theme === 'rain' && (
            <div className="rain-layer">
              <div className="rain-drops" />
              <div className="thunder" />
            </div>
          )}

          <div className="nebula-cloud" />
          <div className="grain" />
        </>
      ) : (
        /* Solid Color Fallback for Performance Mode - Using --bg-page equivalent for contrast */
        <div 
          className="fixed inset-0 z-[1] transition-colors duration-500" 
          style={{ 
            backgroundColor: 
              theme === 'sea' ? '#000507' : 
              theme === 'forest' ? '#020806' : 
              theme === 'rain' ? '#0c0a09' : '#020408',
            opacity: customBg ? 0.8 : 1 // Let the image show through slightly in performance mode
          }} 
        />
      )}

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
          <LoadingOverlay />
      <Analytics />
      <SpeedInsights />
    </div>
  );
}

export default App;