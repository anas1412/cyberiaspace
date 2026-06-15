import React from 'react';
import { useStore } from '../../store/useStore';
import { FocusOverlay } from './FocusOverlay';
import TextEditor from './TextEditor';
import TasksEditor from './TasksEditor';
import TableEditor from './TableEditor';
import PaintEditor from './PaintEditor';
import EmbedEditor from './EmbedEditor';
import FileEditor from './FileEditor';

const EDITOR_MAP: Record<string, React.ComponentType<{ thought: any; onClose: () => void }>> = {
  text: TextEditor,
  tasks: TasksEditor,
  table: TableEditor,
  paint: PaintEditor,
  embed: EmbedEditor,
  file: FileEditor,
};

const FocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const thoughts = useStore((state) => state.thoughts);
  const setActiveFocus = useStore((state) => state.setActiveFocus);

  const thought = activeFocusId ? thoughts.find((t) => t.id === activeFocusId) : undefined;

  if (!thought || !focusType) return null;

  const EditorComponent = EDITOR_MAP[focusType];
  if (!EditorComponent) return null;

  return (
    <FocusOverlay isVisible onClose={() => setActiveFocus(null, null)}>
      <EditorComponent thought={thought} onClose={() => setActiveFocus(null, null)} />
    </FocusOverlay>
  );
};

export default FocusEditor;
