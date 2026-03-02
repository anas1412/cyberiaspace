import { type Space, type Thought, type Stack } from '../db';
import { type User, type SubscriptionPlan, type AccessPeriod, PLAN_CONFIG } from '../constants';

export interface CyberiaState {
  activeSpaceId: string | null;
  spaces: Space[];
  thoughts: Thought[];
  stacks: Stack[];
  selectedThoughtId: number | null;
  selectedThoughtIds: number[];
  isInspectorOpen: boolean;
  activeFocusId: number | null;
  focusType: 'text' | 'table' | 'paint' | 'tasks' | 'embed' | 'file' | 'image' | null;
  calendarViewDate: Date;
  hoveredCalDate: string | null;
  linkingSourceId: number | null;
  calendarSearchQuery: string;
  calendarStackFilter: string | null;
  kanbanSearchQuery: string;
  kanbanStackFilter: string | null;
  theme: 'cyberia' | 'sea' | 'forest' | 'rain';
  customBg: string | null;
  isSpaceLoading: boolean;
  totalThoughtCount: number;
  isInitializing: boolean;
  performanceMode: boolean;
  setPerformanceMode: (mode: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deferredPrompt: any;
  layerActionTrigger: { id: number; time: number } | null;
  history: any[];
  historyIndex: number;
  isLightboxOpen: boolean;
  lightboxImage: string | null;
  lightboxThoughtId: number | null;
  transform: { x: number; y: number; scale: number };
  deletingThoughtIds: number[];
  isDemo: boolean;
  _savedUserState: { spaces: Space[]; thoughts: Thought[]; stacks: Stack[]; activeSpaceId: string | null } | null;
  setDemoMode: (enabled: boolean) => void;
  loadOnboardingData: () => void;

  getLimits: () => typeof PLAN_CONFIG['free'];

  oracleMode: boolean;
  isChatOpen: boolean;

  init: () => Promise<void>;
  refreshTotalThoughtCount: () => Promise<void>;
  refreshSpaces: () => Promise<void>;
  refreshThoughts: (spaceId?: string) => Promise<void>;
  refreshStacks: (spaceId?: string) => Promise<void>;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  openLightbox: (image: string, thoughtId: number) => void;
  closeLightbox: () => void;
  setTransform: (transform: { x: number; y: number; scale: number }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetTransform: () => void;
  clearWorkspace: () => Promise<void>;
  completeOnboarding: () => Promise<void>;

  setTheme: (theme: 'cyberia' | 'sea' | 'forest' | 'rain') => void;
  setCustomBg: (bg: string | null) => Promise<void>;
  setDeferredPrompt: (prompt: any) => void;

  toggleOracleMode: () => void;
  setChatOpen: (isOpen: boolean) => void;

  setActiveSpace: (id: string) => void;
  setCalendarViewDate: (date: Date) => void;
  addSpace: (name: string) => Promise<void>;
  updateSpace: (id: string, updates: Partial<Space>) => Promise<void>;
  deleteSpace: (id: string) => Promise<void>;
  reorderSpaces: (spaces: Space[]) => Promise<void>;
  saveSpaceTransform: (id: string, transform: { x: number; y: number; scale: number }) => Promise<void>;

  addThought: (thought: Partial<Thought>) => Promise<number>;
  updateThought: (id: number, updates: Partial<Thought>) => Promise<void>;
  updateThoughts: (ids: number[], updates: Partial<Thought>) => Promise<void>;
  deleteThought: (id: number) => Promise<void>;
  deleteThoughts: (ids: number[]) => Promise<void>;
  bringToFront: (id: number) => Promise<void>;
  sendToBack: (id: number) => Promise<void>;
  setSelectedThoughtId: (id: number | null) => void;
  setSelectedThoughtIds: (ids: number[]) => void;
  toggleThoughtSelection: (id: number) => void;
  clearSelection: () => void;
  deleteSelectedThoughts: () => Promise<void>;
  linkSelectedThoughts: (name?: string) => Promise<void>;
  unlinkSelectedThoughts: () => Promise<void>;
  setInspectorOpen: (open: boolean) => void;
  setActiveFocus: (id: number | null, type: 'text' | 'table' | 'paint' | 'tasks' | 'embed' | 'file' | 'image' | null) => void;

  setHoveredCalDate: (date: string | null) => void;
  setCalendarSearchQuery: (query: string) => void;
  setCalendarStackFilter: (stackId: string | null) => void;
  setKanbanSearchQuery: (query: string) => void;
  setKanbanStackFilter: (stackId: string | null) => void;
  setLinkingSourceId: (id: number | null) => void;

  createStack: (name: string, thoughtId: number) => Promise<void>;
  updateStack: (id: string, updates: Partial<Stack>) => Promise<void>;
  deleteStack: (id: string) => Promise<void>;
  cleanupStacks: () => Promise<void>;

  isReadOnly: boolean;
  creatorName: string | null;
  lastUpdated: string | null;
  publishSpace: (id: string) => Promise<string | void>;
  unpublishSpace: (id: string) => Promise<void>;
  importFullState: (data: any) => Promise<void>;

  clearLocalData: () => Promise<void>;
  exportData: () => Promise<void>;
  importData: (file: File) => Promise<void>;
  isLocalWorkspaceEmpty: () => Promise<boolean>;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshSecret: string | null;
  grantedScopes: string[];
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  syncStatus: 'synced' | 'syncing' | 'error' | 'offline';
  lastSync: Date | null;
  autoSync: boolean;
  cloudUsage: number;
  storageUsageMB: number;
  isOnline: boolean;

  setAuthenticatedUser: (user: User, token: string, refreshSecret?: string, scopes?: string[]) => Promise<void>;
  handleAuthCode: (code: string) => Promise<void>;
  requestServiceAccess: (scope: string, token: string) => void;
  signOut: () => Promise<void>;
  syncData: () => Promise<void>;
  syncToServices: () => Promise<void>;
  deleteServiceContent: (thought: any) => Promise<void>;
  processPendingDeletions: () => Promise<void>;
  processOfflineChanges: () => Promise<void>;
  processPendingBlobs: () => Promise<void>;
  uploadThoughtBlob: (thoughtId: number) => Promise<void>;
  importCloudData: () => Promise<unknown | null>;
  setAutoSync: (enabled: boolean) => void;
  deleteCloudData: () => Promise<void>;
  calculateUsage: (thoughtCount: number) => void;
  initAuth: () => void;
  handlePostAuthSync: () => Promise<void>;
  _syncPromise: Promise<void> | null;
  mediaSweep: () => Promise<void>;
  upgradePlan: (plan: SubscriptionPlan, period?: AccessPeriod) => void;
  checkExpiry: () => void;
  refreshProfile: () => Promise<void>;
  updateSettings: (settings: Partial<User['settings']>) => Promise<void>;
  cancelSubscription: () => void;
}
