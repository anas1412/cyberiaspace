import { type Space, type Thought, type Stack } from '../db';
import { type User, type SubscriptionPlan, type AccessPeriod, PLAN_CONFIG } from '../constants';

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
  hoveredCalDate: string | null;
  linkingSourceId: string | null;
  calendarSearchQuery: string;
  calendarStackFilter: string | null;
  kanbanSearchQuery: string;
  kanbanStackFilter: string | null;
  theme: 'cyberia' | 'sea' | 'forest' | 'rain';
  customBg: string | null;
  isSpaceLoading: boolean;
  lastSpaceRequestId: number;
  totalThoughtCount: number;
  isInitializing: boolean;
  performanceMode: boolean;
  setPerformanceMode: (mode: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deferredPrompt: any;
  layerActionTrigger: { id: string; time: number } | null;
  history: any[];
  historyIndex: number;
  isLightboxOpen: boolean;
  lightboxImage: string | null;
  lightboxThoughtId: string | null;
  transform: { x: number; y: number; scale: number };
  deletingThoughtIds: string[];
  isDemo: boolean;
  _savedUserState: { spaces: Space[]; thoughts: Thought[]; stacks: Stack[]; activeSpaceId: string | null } | null;
  createInitialWorkspace: () => Promise<void>;

  getLimits: () => typeof PLAN_CONFIG['free'];

  oracleMode: boolean;
  isChatOpen: boolean;
  oracleChatMode: 'chat' | 'action';

  init: () => Promise<void>;
  refreshTotalThoughtCount: () => Promise<void>;
  refreshSpaces: () => Promise<void>;
  refreshThoughts: (spaceId?: string) => Promise<void>;
  scatterThoughts: (spaceId?: string) => Promise<void>;
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
  clearWorkspace: () => Promise<void>;

  setTheme: (theme: 'cyberia' | 'sea' | 'forest' | 'rain') => void;
  setCustomBg: (bg: File | string | null) => Promise<void>;
  setDeferredPrompt: (prompt: any) => void;

  toggleOracleMode: () => void;
  setChatOpen: (isOpen: boolean) => void;
  setOracleChatMode: (mode: 'chat' | 'action') => void;

  setActiveSpace: (id: string) => Promise<void>;
  setCalendarViewDate: (date: Date) => void;
  addSpace: (name: string) => Promise<void>;
  updateSpace: (id: string, updates: Partial<Space>, options?: { skipSync?: boolean }) => Promise<void>;
  deleteSpace: (id: string) => Promise<void>;
  reorderSpaces: (spaces: Space[]) => Promise<void>;
  saveSpaceTransform: (id: string, transform: { x: number; y: number; scale: number }) => Promise<void>;

  addThought: (thought: Partial<Thought>) => Promise<string>;
  addThoughts: (thoughts: Partial<Thought>[]) => Promise<string[]>;
  patchThought: (id: string, updates: Partial<Thought>) => void;
  updateThought: (id: string, updates: Partial<Thought>, options?: { skipSync?: boolean }) => Promise<void>;
  updateThoughts: (ids: string[], updates: Partial<Thought>, options?: { skipSync?: boolean }) => Promise<void>;
  bulkUpdateThoughts: (updates: { id: string; updates: Partial<Thought> }[], options?: { skipSync?: boolean }) => Promise<void>;
  deleteThought: (id: string) => Promise<void>;
  deleteThoughts: (ids: string[]) => Promise<void>;
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
  setCalendarStackFilter: (stackId: string | null) => void;
  setKanbanSearchQuery: (query: string) => void;
  setKanbanStackFilter: (stackId: string | null) => void;
  setLinkingSourceId: (id: string | null) => void;

  createStack: (name: string, thoughtId: string) => Promise<void>;
  updateStack: (id: string, updates: Partial<Stack>) => Promise<void>;
  deleteStack: (id: string) => Promise<void>;
  cleanupStacks: () => Promise<void>;

  isReadOnly: boolean;
  creatorName: string | null;
  lastUpdated: string | null;
  publishSpace: (id: string) => Promise<string | void>;
  unpublishSpace: (id: string) => Promise<void>;
  importFullState: (data: any, merge?: boolean) => Promise<void>;

  clearLocalData: () => Promise<void>;
  exportData: () => Promise<void>;
  importData: (file: File) => Promise<void>;
  cleanupTrash: () => Promise<void>;
  isLocalWorkspaceEmpty: () => Promise<boolean>;
  migrateLegacyData: (userId: string) => Promise<void>;
  ensureWorkspaceForCurrentUser: () => Promise<void>;
  mergeGuestSpace: (sourceSpaceId: string, targetSpaceId: string) => Promise<boolean>;
  replaceCloudSpace: (sourceSpaceId: string, targetSpaceIdToReplace: string) => Promise<boolean>;
  discardGuestSpace: (id: string) => Promise<boolean>;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  accessTokenExpiresAt: number | null;
  refreshSecret: string | null;
  grantedScopes: string[];
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  syncStatus: 'synced' | 'syncing' | 'error' | 'offline';
  lastSync: Date | null;
  autoSync: boolean;
  cloudUsage: number;
  storageUsageMB: number;
  activeDownloads: string[];
  isOnline: boolean;

  setAuthenticatedUser: (user: User, token: string, refreshSecret?: string, scopes?: string[], expiresIn?: number) => Promise<void>;
  handleAuthCode: (code: string) => Promise<void>;
  requestServiceAccess: (scope: string, token: string) => void;
  signOut: () => Promise<void>;
  syncData: () => Promise<void>;
  syncToServices: () => Promise<void>;
  processOfflineChanges: () => Promise<void>;
  uploadThoughtBlob: (thoughtId: string, force?: boolean) => Promise<void>;
  downloadSingleBlob: (thoughtId: string) => Promise<void>;
  downloadMissingBlobs: () => Promise<void>;
  healSpaceBackgrounds: () => Promise<void>;
  removeCloudAsset: (thoughtId: string) => Promise<void>;
  importCloudData: () => Promise<unknown | null>;
  setAutoSync: (enabled: boolean) => void;
  deleteCloudData: () => Promise<void>;
  calculateUsage: (thoughtCount: number) => void;
  initAuth: () => void;
  handlePostAuthSync: () => Promise<void>;
  _syncPromise: Promise<void> | null;
  mediaSweep: () => Promise<void>;
  repairEmptyFileThoughts: () => Promise<number>;
  upgradePlan: (plan: SubscriptionPlan, period?: AccessPeriod) => void;
  checkExpiry: () => void;
  handlePlanRegression: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getOrRefreshToken: () => Promise<string | null>;
  updateSettings: (settings: Partial<User['settings']>) => Promise<void>;
  cancelSubscription: () => void;
  setupRefreshInterval: () => void;
}
