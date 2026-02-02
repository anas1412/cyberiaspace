import { useEffect } from 'react';
import { useStore } from './store/useStore';
import Viewport from './components/Viewport';
import Toolbar from './components/Toolbar';
import Inspector from './components/Inspector';
import EmptyState from './components/EmptyState';
import KanbanOverlay from './components/KanbanOverlay';
import CalendarOverlay from './components/CalendarOverlay';

function App() {
  const init = useStore((state) => state.init);
  const addThought = useStore((state) => state.addThought);
  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const items = clipboardData.items;
      
      // Priority 1: Images
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = async (event) => {
              const id = await addThought({ 
                type: 'image', 
                image: event.target?.result as string, 
                text: "Pasted Image" 
              });
              setSelectedThoughtId(id);
              setInspectorOpen(true);
            };
            reader.readAsDataURL(blob);
            e.preventDefault();
            return;
          }
        }
      }

      // Priority 2: Text
      const text = clipboardData.getData('text');
      if (text && text.trim()) {
        e.preventDefault();
        const id = await addThought({ 
          type: 'text', 
          text: "Note", 
          content: text 
        });
        setSelectedThoughtId(id);
        setInspectorOpen(true);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addThought, setSelectedThoughtId, setInspectorOpen]);

  return (
    <div className="w-full h-full relative">
      <Viewport />
      <EmptyState />
      <KanbanOverlay />
      <CalendarOverlay />
      <Toolbar />
      <Inspector />
      
      {/* Modals and Lightbox would go here */}
    </div>
  );
}

export default App;