import React, { lazy } from 'react';
import { 
  Tag, 
  Type, 
  ListTodo, 
  Palette, 
  Table, 
  Youtube, 
  File as FileIcon
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { type Thought, type ThoughtType, type ThoughtPayload } from '../../db';

// Renderers
import { LabelRenderer } from './LabelRenderer';
import { TextRenderer } from './TextRenderer';
import { TasksRenderer } from './TasksRenderer';
import { TableRenderer } from './TableRenderer';
import { PaintRenderer } from './PaintRenderer';
import { EmbedRenderer } from './EmbedRenderer';
import { FileRenderer } from './FileRenderer';

// Inspectors
import { LabelInspector } from './inspectors/LabelInspector';
import { TextInspector } from './inspectors/TextInspector';
import { TasksInspector } from './inspectors/TasksInspector';
import { TableInspector } from './inspectors/TableInspector';
import { PaintInspector } from './inspectors/PaintInspector';
import { EmbedInspector } from './inspectors/EmbedInspector';
import { FileInspector } from './inspectors/FileInspector';

// Lazy Focus Editors
const TextFocusEditor = lazy(() => import('../editors/TextFocusEditor'));
const TasksFocusEditor = lazy(() => import('../editors/TasksFocusEditor'));
const TableFocusEditor = lazy(() => import('../editors/TableFocusEditor'));
const PaintFocusEditor = lazy(() => import('../editors/PaintFocusEditor'));
const EmbedFocusEditor = lazy(() => import('../editors/EmbedFocusEditor'));
const FileFocusEditor = lazy(() => import('../editors/FileFocusEditor'));

export interface ThoughtRendererProps {
  thought: Thought;
  isReadOnly: boolean;
  isCalendar?: boolean;
  isSpatial?: boolean;
  parsedContent?: string | Promise<string>;
  setActiveFocus: (id: number, type: any) => void;
  setSelectedThoughtId?: (id: number | null) => void;
  setInspectorOpen?: (open: boolean) => void;
}

export interface FocusEditorProps {
  thoughtId: number;
  onClose: () => void;
}

export interface InspectorPanelProps {
  thought: Thought;
  isReadOnly: boolean;
}

export interface ThoughtTypeConfig {
  type: ThoughtType;
  label: string;
  icon: LucideIcon;
  
  // Renderers
  renderer: React.ComponentType<ThoughtRendererProps>;
  
  // Editors
  focusEditor?: React.LazyExoticComponent<React.ComponentType<any>>;
  inspectorPanel?: React.ComponentType<InspectorPanelProps>;
  
  // Factory
  createPayload: () => ThoughtPayload;
  
  // Capabilities
  hasFooter: boolean;
  supportsFocusMode: boolean;
  supportsInspector: boolean;
}

export const ThoughtRegistry: Record<ThoughtType, ThoughtTypeConfig> = {
  label: {
    type: 'label',
    label: 'Label',
    icon: Tag,
    renderer: LabelRenderer as any,
    inspectorPanel: LabelInspector,
    createPayload: () => ({ type: 'label' }),
    hasFooter: true,
    supportsFocusMode: false,
    supportsInspector: true
  },
  text: {
    type: 'text',
    label: 'Text',
    icon: Type,
    renderer: TextRenderer as any,
    focusEditor: TextFocusEditor,
    inspectorPanel: TextInspector,
    createPayload: () => ({ type: 'text', content: '' }),
    hasFooter: true,
    supportsFocusMode: true,
    supportsInspector: true
  },
  tasks: {
    type: 'tasks',
    label: 'Tasks',
    icon: ListTodo,
    renderer: TasksRenderer as any,
    focusEditor: TasksFocusEditor,
    inspectorPanel: TasksInspector,
    createPayload: () => ({ type: 'tasks', tasks: [] }),
    hasFooter: true,
    supportsFocusMode: true,
    supportsInspector: true
  },
  table: {
    type: 'table',
    label: 'Table',
    icon: Table,
    renderer: TableRenderer as any,
    focusEditor: TableFocusEditor,
    inspectorPanel: TableInspector,
    createPayload: () => ({ type: 'table', rows: [['', ''], ['', '']] }),
    hasFooter: true,
    supportsFocusMode: true,
    supportsInspector: true
  },
  paint: {
    type: 'paint',
    label: 'Paint',
    icon: Palette,
    renderer: PaintRenderer as any,
    focusEditor: PaintFocusEditor,
    inspectorPanel: PaintInspector,
    createPayload: () => ({ type: 'paint', drawing: '' }),
    hasFooter: true,
    supportsFocusMode: true,
    supportsInspector: true
  },
  embed: {
    type: 'embed',
    label: 'Embed',
    icon: Youtube,
    renderer: EmbedRenderer as any,
    focusEditor: EmbedFocusEditor,
    inspectorPanel: EmbedInspector,
    createPayload: () => ({ type: 'embed', url: '' }),
    hasFooter: true,
    supportsFocusMode: true,
    supportsInspector: true
  },
  file: {
    type: 'file',
    label: 'File',
    icon: FileIcon,
    renderer: FileRenderer as any,
    focusEditor: FileFocusEditor,
    inspectorPanel: FileInspector,
    createPayload: () => ({ type: 'file', url: '', name: '', size: 0 }),
    hasFooter: true,
    supportsFocusMode: true,
    supportsInspector: true
  }
};

export function getThoughtConfig(type: ThoughtType): ThoughtTypeConfig {
  return ThoughtRegistry[type];
}
