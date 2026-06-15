import { type Space, type Thought, type Stack, type ThoughtType } from '../db';

export interface CyberiaState {
  activeSpaceId: string | null;
  spaces: Space[];
  thoughts: Thought[];
  stacks: Stack[];
  selectedThoughtId: string | null;
  selectedThoughtIds: string[];
  isInspectorOpen: boolean;
  activeFocusId: string | null;
  focusType: 'text' | 'table' | 'paint' | 'tasks' | 'embed' | 'file' | null;
  calendarViewDate: Date;
  calendarViewMode: 'month' | 'week' | 'agenda';
  hoveredCalDate: string | null;
  linkingSourceId: string | null;
  calendarSearchQuery: string;
  calendarStackFilter: string | null;
  calendarStatusFilter: string[] | null;
  calendarTypeFilter: ThoughtType[] | null;
  kanbanSearchQuery: string;
  kanbanStackFilter: string | null;
  kanbanStatusFilter: string[] | null;
  kanbanDateFilter: string | null;
  kanbanTypeFilter: ThoughtType[] | null;
  spatialSearchQuery: string;
  spatialStackFilter: string | null;
  spatialStatusFilter: string[] | null;
  spatialDateFilter: string | null;
  spatialTypeFilter: ThoughtType[] | null;
  showArchived: boolean;
  theme: 'dark' | 'light';

  customBg: string | null;
  customBgLoading: boolean;
  customBgOpacity: number;
  isSpaceLoading: boolean;
  setSpaceLoading: (loading: boolean) => void;
  lastSpaceRequestId: number;
  totalThoughtCount: number;
  isInitializing: boolean;
  setInitializing: (isInitializing: boolean) => void;
  setInitializationState: (isInitializing: boolean, isSpaceLoading: boolean) => void;
  physicsIntensity: number;
  setPhysicsIntensity: (intensity: number) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deferredPrompt: any;
  layerActionTrigger: { id: string; time: number } | null;
  history: any[];
  historyIndex: number;
  isLightboxOpen: boolean;
  lightboxImage: string | null;
  lightboxThoughtId: string | null;
  inspectorTitleFocusId: string | null;
  setInspectorTitleFocusId: (id: string | null) => void;
  transform: { x: number; y: number; scale: number };
  deletingThoughtIds: string[];
  isDraggingThought: boolean;
  setDraggingThought: (isDragging: boolean) => void;
  isOverDeleteZone: boolean;
  setOverDeleteZone: (isOver: boolean) => void;
  isDemo: boolean;
  _savedUserState: { spaces: Space[]; thoughts: Thought[]; stacks: Stack[]; activeSpaceId: string | null } | null;
  createInitialWorkspace: () => Promise<void>;

  isChatOpen: boolean;
  aiChatMode: 'chat' | 'action';

  init: () => Promise<void>;
  refreshTotalThoughtCount: () => Promise<void>;
  refreshSpaces: () => Promise<void>;
  refreshThoughts: (spaceId?: string) => Promise<void>;
  refreshStacks: (spaceId?: string) => Promise<void>;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  openLightbox: (image: string, thoughtId: string) => void;
  closeLightbox: () => void;
  setTransform: (transform: { x: number; y: number; scale: number }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetTransform: () => void;

  setTheme: (theme: 'dark' | 'light') => void;
  setCustomBg: (bg: File | string | null) => Promise<void>;
  setCustomBgValue: (bg: string | null) => void;
  setCustomBgOpacity: (opacity: number) => void;
  setDeferredPrompt: (prompt: any) => void;

  setChatOpen: (isOpen: boolean) => void;
  setAiChatMode: (mode: 'chat' | 'action') => void;

  setActiveSpace: (id: string) => Promise<void>;
  setCalendarViewDate: (date: Date) => void;
  setCalendarViewMode: (mode: 'month' | 'week' | 'agenda') => void;
  addSpace: (name: string) => Promise<void>;
  updateSpace: (id: string, updates: Partial<Space>) => Promise<void>;
  deleteSpace: (id: string) => Promise<void>;
  reorderSpaces: (spaces: Space[]) => Promise<void>;
  saveSpaceTransform: (id: string, transform: { x: number; y: number; scale: number }) => Promise<void>;

  addThought: (thought: Partial<Thought>) => Promise<string>;
  addThoughts: (thoughts: Partial<Thought>[]) => Promise<string[]>;
  patchThought: (id: string, updates: Partial<Thought>) => void;
  updateThought: (id: string, updates: Partial<Thought>) => Promise<void>;
  updateThoughts: (ids: string[], updates: Partial<Thought>) => Promise<void>;
  bulkUpdateThoughts: (updates: { id: string; updates: Partial<Thought> }[]) => Promise<void>;
  deleteThought: (id: string) => Promise<void>;
  deleteThoughts: (ids: string[]) => Promise<void>;
  archiveThought: (id: string) => Promise<void>;
  archiveThoughts: (ids: string[]) => Promise<void>;
  unarchiveThought: (id: string) => Promise<void>;
  unarchiveThoughts: (ids: string[]) => Promise<void>;
  bringToFront: (id: string) => Promise<void>;
  sendToBack: (id: string) => Promise<void>;
  setSelectedThoughtId: (id: string | null) => void;
  setSelectedThoughtIds: (ids: string[]) => void;
  toggleThoughtSelection: (id: string) => void;
  clearSelection: () => void;
  deleteSelectedThoughts: () => Promise<void>;
  linkSelectedThoughts: (name?: string, targetIds?: string[]) => Promise<void>;
  unlinkSelectedThoughts: () => Promise<void>;
  setInspectorOpen: (open: boolean) => void;
  setActiveFocus: (id: string | null, type: 'text' | 'table' | 'paint' | 'tasks' | 'embed' | 'file' | null) => void;

  setHoveredCalDate: (date: string | null) => void;
  setCalendarSearchQuery: (query: string) => void;
  setCalendarStackFilter: (stackIds: string[] | null) => void;
  setCalendarStatusFilter: (statuses: string[] | null) => void;
  setCalendarTypeFilter: (types: ThoughtType[] | null) => void;
  setKanbanSearchQuery: (query: string) => void;
  setKanbanStackFilter: (stackIds: string[] | null) => void;
  setKanbanStatusFilter: (statuses: string[] | null) => void;
  setKanbanDateFilter: (date: string | null) => void;
  setKanbanTypeFilter: (types: ThoughtType[] | null) => void;
  setSpatialSearchQuery: (query: string) => void;
  setSpatialStackFilter: (stackIds: string[] | null) => void;
  setSpatialStatusFilter: (statuses: string[] | null) => void;
  setSpatialDateFilter: (date: string | null) => void;
  setSpatialTypeFilter: (types: ThoughtType[] | null) => void;

  directorySearchQuery: string;
  directoryGroupBy: 'stack' | 'status' | 'date' | 'priority' | 'type';
  directorySortBy: 'order' | 'alpha' | 'alpha-reverse' | 'date-newest' | 'date-oldest';
  directoryCollapsedGroups: Set<string>;
  directorySelectedThoughtId: string | null;
  setDirectorySearchQuery: (query: string) => void;
  setDirectoryGroupBy: (groupBy: 'stack' | 'status' | 'date' | 'priority' | 'type') => void;
  setDirectorySortBy: (sortBy: 'order' | 'alpha' | 'alpha-reverse' | 'date-newest' | 'date-oldest') => void;
  setDirectoryCollapsedGroups: (groups: Set<string>) => void;
  toggleDirectoryGroupCollapse: (groupId: string) => void;
  setDirectorySelectedThoughtId: (id: string | null) => void;

  setShowArchived: (show: boolean) => void;
  setLinkingSourceId: (id: string | null) => void;

  createStack: (name: string, thoughtId: string) => Promise<void>;
  updateStack: (id: string, updates: Partial<Stack>) => Promise<void>;
  deleteStack: (id: string) => Promise<void>;
  deleteStackWithThoughts: (id: string) => Promise<void>;
  cleanupStacks: () => Promise<void>;

  isReadOnly: boolean;
  creatorName: string | null;
  lastUpdated: string | null;

  resetStoreState: (theme?: 'dark' | 'light') => void;
  exportData: () => Promise<void>;
  importData: (file: File) => Promise<void>;
  cleanupTrash: () => Promise<void>;
  isLocalWorkspaceEmpty: () => Promise<boolean>;
  ensureWorkspaceForCurrentUser: () => Promise<void>;
}
