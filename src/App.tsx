import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useStore } from './store/useStore';
import { useModalStore } from './store/useModalStore';
import { LIMITS } from './constants';
import Viewport from './components/Viewport';
import Toolbar from './components/Toolbar';
import Inspector from './components/Inspector';
import EmptyState from './components/EmptyState';
import KanbanOverlay from './components/KanbanOverlay';
import CalendarOverlay from './components/CalendarOverlay';
import Modal from './components/Modal';
import Lightbox from './components/Lightbox';
import TextFocusEditor from './components/TextFocusEditor';
import TableFocusEditor from './components/TableFocusEditor';
import PaintFocusEditor from './components/PaintFocusEditor';
import TasksFocusEditor from './components/TasksFocusEditor';

function App() {
  const init = useStore((state) => state.init);
  const setDeferredPrompt = useStore((state) => state.setDeferredPrompt);
  const thoughts = useStore((state) => state.thoughts);
  const addThought = useStore((state) => state.addThought);
  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  
  const { openModal } = useModalStore();

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
            const isGif = imageItem.type === 'image/gif';
            const id = await addThought({ 
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
        const id = await addThought({ 
          type: 'text', 
          text: "Note", 
          content: text 
        });
        if (id !== -1) {
          setSelectedThoughtId(id);
          setInspectorOpen(true);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addThought, setSelectedThoughtId, setInspectorOpen, thoughts.length, openModal]);

  return (
    <div className="w-full h-full relative">
      <Viewport />
      <EmptyState />
      <KanbanOverlay />
      <CalendarOverlay />
      <Toolbar />
      <Inspector />
      <Modal />
      <Lightbox />
      <TextFocusEditor />
      <TableFocusEditor />
      <PaintFocusEditor />
      <TasksFocusEditor />
      <Analytics />
      <SpeedInsights />
      {/* Modals and Lightbox would go here */}
    </div>
  );
}

export default App;