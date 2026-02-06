import React, { useEffect, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useStore } from './store/useStore';
import { useModalStore } from './store/useModalStore';
import { LIMITS } from './constants';
import Viewport from './components/Viewport';                                                                                            
import Toolbar from './components/Toolbar';                                                                                              
import Inspector from './components/Inspector';                                                                                          
import MultiSelectionMenu from './components/MultiSelectionMenu';
import EmptyState from './components/EmptyState';                                                                                        
import KanbanOverlay from './components/KanbanOverlay';                                                                                  
import CalendarOverlay from './components/CalendarOverlay';                                                                              
import Modal from './components/Modal';                                                                                                  
import Lightbox from './components/Lightbox';                                                                                            
import TextFocusEditor from './components/TextFocusEditor';                                                                              
import TableFocusEditor from './components/TableFocusEditor';                                                                            
import PaintFocusEditor from './components/PaintFocusEditor';                                                                            
import TasksFocusEditor from './components/TasksFocusEditor';                                                                            
import EmbedFocusEditor from './components/EmbedFocusEditor';
import ChatOverlay from './components/ChatOverlay';
import MobileNotSupported from './components/MobileNotSupported';

import { fetchYouTubeMeta, getYouTubeVideoId } from './utils/youtube';

function App() {
  const init = useStore((state) => state.init);
  const setDeferredPrompt = useStore((state) => state.setDeferredPrompt);
  const thoughts = useStore((state) => state.thoughts);
  const addThought = useStore((state) => state.addThought);
  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);
  
  const { openModal } = useModalStore();
  const mouseWorldPos = useRef({ x: 0, y: 0 });
  const mouseScreenPos = useRef({ x: 0, y: 0 });

  const [isMobile, setIsMobile] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseScreenPos.current = { x: e.clientX, y: e.clientY };
      const activeSpace = useStore.getState().spaces.find(s => s.id === useStore.getState().activeSpaceId);
      
      if (activeSpace?.mode === 'spatial') {
        const tx = activeSpace.transformX ?? 0;
        const ty = activeSpace.transformY ?? 0;
        const scale = activeSpace.transformScale ?? 1;
        mouseWorldPos.current = {
          x: (e.clientX - tx) / scale,
          y: (e.clientY - ty) / scale
        };
      } else {
        mouseWorldPos.current = { x: e.clientX, y: e.clientY };
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
    init();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [init, setDeferredPrompt]);


  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (thoughts.length >= LIMITS.MAX_THOUGHTS_PER_SPACE) {
        openModal({
          title: 'Limit Reached',
          description: `You have reached the maximum of ${LIMITS.MAX_THOUGHTS_PER_SPACE} thoughts per space.`,
          type: 'limit_thought',
          confirmText: 'Okay'
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
        e.preventDefault();
        
        const cleanText = text.trim();
        const videoId = getYouTubeVideoId(cleanText);
        
        if (videoId) {
          const id = await addThought({ 
            ...getPlacementProps(),
            type: 'embed', 
            text: "Loading Title...", 
            content: cleanText 
          });
          
          if (id !== -1) {
            setSelectedThoughtId(id);
            // We specifically don't open the inspector for YouTube pastes 
            // to keep the flow uninterrupted.
            
            fetchYouTubeMeta(cleanText)
              .then(metadata => {
                if (metadata && metadata.title) {
                  useStore.getState().updateThought(id, {
                    text: metadata.title,
                    description: metadata.author_name || ""
                  });
                }
              })
              .catch(err => {
                console.warn("YouTube metadata fetch failed:", err);
                useStore.getState().updateThought(id, { text: "YouTube Video" });
              });
          }
        } else {
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
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addThought, setSelectedThoughtId, setInspectorOpen, thoughts.length, openModal]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-black">
      {isMobile ? (
        <MobileNotSupported />
      ) : (
        <>
          {/* Deep Space Background Layers */}
          <div className="stars-layer stars-1" />
          <div className="stars-layer stars-2" />
          <div className="stars-layer stars-twinkle" />
          <div className="nebula-cloud" />
          <div className="grain" />
          
          <Viewport />
          <EmptyState />
          <KanbanOverlay />
          <CalendarOverlay />
          <Toolbar />
          <Inspector />
          <MultiSelectionMenu />
          <ChatOverlay />
          <Modal />
          <Lightbox />
          <TextFocusEditor />
          <TableFocusEditor />
          <PaintFocusEditor />
          <TasksFocusEditor />
          <EmbedFocusEditor />
        </>
      )}
      <Analytics />
      <SpeedInsights />
    </div>
  );
}

export default App;