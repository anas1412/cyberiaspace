import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { ChevronDown, ChevronRight, FolderOpen, Eye, Edit3, Split, Download, Search, X, Layers } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { type Thought } from '../db';
import { FocusEditorShell } from './editors/FocusEditorShell';
import { useThoughtPayload } from './thought/hooks/useThoughtPayload';
import { syncOrchestrator } from '../services/sync/syncOrchestrator';
import { TextEditorContent } from './editors/content/TextEditorContent';
import { SidebarLayout } from './SidebarLayout';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type GroupBy = 'stack' | 'status' | 'date';

interface GroupItem {
  id: string;
  text: string;
  type: string;
  status: string;
}

interface Group {
  id: string;
  name: string;
  color?: string;
  thoughts: GroupItem[];
}

// Directory Filter Bar - same as Calendar but adds groupBy tabs
const DirectoryFilterBar: React.FC<{
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  stackFilter: string | null;
  setStackFilter: (id: string | null) => void;
  groupBy: GroupBy;
  setGroupBy: (g: GroupBy) => void;
}> = ({ searchQuery, setSearchQuery, stackFilter, setStackFilter, groupBy, setGroupBy }) => {
  const stacks = useStore((state) => state.stacks);
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const isReadOnly = useStore((state) => state.isReadOnly);
  
  const reelRef = useRef<HTMLDivElement>(null);
  const activeStacks = isReadOnly ? stacks : stacks.filter(s => s.spaceId === activeSpaceId);

  // Enable horizontal scrolling with mouse wheel
  useEffect(() => {
    const el = reelRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4 border-b border-[var(--glass-border)]">
      {/* Search Input */}
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] group-focus-within:text-[var(--accent)] transition-colors" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
          className="w-full h-9 bg-[var(--bg-page)] border border-[var(--glass-border)] rounded-xl pl-9 pr-9 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/10 transition-all placeholder:text-[var(--text-muted)]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-[var(--text-primary)]/10 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Stack Reel */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers className="w-3 h-3 text-[var(--text-muted)]" />
            <span className="text-[8px] font-semibold tracking-widest text-[var(--text-muted)]">Stacks</span>
          </div>
          {stackFilter && (
            <button
              onClick={() => setStackFilter(null)}
              className="text-[8px] font-medium tracking-widest text-[var(--accent)] hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <div ref={reelRef} className="flex gap-1.5 overflow-x-auto custom-scroll pb-2">
          <button
            onClick={() => setStackFilter(null)}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-medium tracking-widest border transition-all",
              !stackFilter
                ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--text-primary)] shadow-[0_0_10px_var(--accent-glow)]"
                : "bg-[var(--bg-page)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-dimmed)]"
            )}
          >
            All
          </button>
          {activeStacks.map((stack) => (
            <div key={stack.id} className="relative group/stack flex-shrink-0">
              <button
                onClick={() => setStackFilter(stack.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-medium tracking-widest border transition-all truncate max-w-[120px]",
                  stackFilter === stack.id
                    ? "border-current text-[var(--text-primary)] shadow-lg"
                    : "bg-[var(--bg-page)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-dimmed)]"
                )}
                style={stackFilter === stack.id ? { 
                  backgroundColor: stack.color.replace('1)', '0.3)'),
                  color: stack.color 
                } : {}}
              >
                {stack.name}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Group By Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--bg-main)]/40 rounded-xl border border-[var(--glass-border)]">
        {(['stack', 'status', 'date'] as GroupBy[]).map(mode => (
          <button
            key={mode}
            onClick={() => setGroupBy(mode)}
            className={cn(
              "flex-1 py-2 rounded-lg text-[9px] font-semibold tracking-widest transition-all capitalize",
              groupBy === mode ? "bg-[var(--accent)] text-[var(--accent-contrast)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
};

// Inline Focus Editor for text type only
const DirectoryFocusEditor: React.FC<{ 
  thought: Thought; 
  onClose: () => void;
}> = ({ thought, onClose }) => {
  const updateThought = useStore((state) => state.updateThought);
  const isReadOnly = useStore((state) => state.isReadOnly);
  const { content } = useThoughtPayload(thought);
  
  const [editMode, setEditMode] = useState<'edit' | 'preview' | 'split'>('split');
  const [localTitle, setLocalTitle] = useState(thought.text);
  const [localContent, setLocalContent] = useState(content || '');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    setLocalTitle(thought.text);
    setLocalContent(content || '');
  }, [thought.id, content]);

  React.useEffect(() => {
    if (thought?.id) {
      syncOrchestrator.setFocusEditing(true, thought.id);
    }
    return () => {
      syncOrchestrator.setFocusEditing(false, null);
    };
  }, [thought?.id]);

  const handleTitleChange = (val: string) => {
    setLocalTitle(val);
    if (!isReadOnly) updateThought(thought.id, { text: val });
  };

  const handleContentChange = (val: string) => {
    setLocalContent(val);
    if (!isReadOnly) updateThought(thought.id, { data: { type: 'text', content: val } as any });
  };

  return (
    <FocusEditorShell
      isVisible={true}
      isInline={true}
      onClose={onClose}
      title={localTitle}
      onTitleChange={handleTitleChange}
      description={thought.description}
      isReadOnly={isReadOnly}
      maxWidth="100%"
      headerActions={
        <div className="flex bg-[var(--bg-main)]/40 p-1 rounded-xl border border-[var(--glass-border)] relative">
          {[
            { id: 'edit', label: 'Write', icon: Edit3 },
            { id: 'split', label: 'Split', icon: Split },
            { id: 'preview', label: 'Review', icon: Eye }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setEditMode(mode.id as 'edit' | 'preview' | 'split')}
              disabled={isReadOnly && mode.id !== 'preview'}
              className={cn(
                "relative px-3 py-2 rounded-lg text-[9px] font-semibold tracking-widest transition-all duration-300 z-10 flex items-center gap-2",
                editMode === mode.id 
                  ? "text-[var(--accent-contrast)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                isReadOnly && mode.id !== 'preview' && "opacity-30 cursor-not-allowed"
              )}
            >
              {editMode === mode.id && (
                <div className="absolute inset-0 rounded-lg bg-[var(--accent)] shadow-lg shadow-[var(--accent-glow)] z-[-1]" />
              )}
              <mode.icon className="w-3 h-3" />
            </button>
          ))}
        </div>
      }
      footerStatus={
        <p className="text-[8px] uppercase font-black tracking-widest text-[var(--text-muted)]">Live Markdown Environment</p>
      }
      footerActions={
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              const blob = new Blob([localContent], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${thought.text || 'note'}.txt`;
              a.click();
              URL.revokeObjectURL(url);
            }} 
            className="text-[8px] uppercase font-black tracking-widest text-[var(--text-dimmed)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" /> TXT
          </button>
          <button 
            onClick={() => {
              const blob = new Blob([localContent], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${thought.text || 'note'}.md`;
              a.click();
              URL.revokeObjectURL(url);
            }} 
            className="text-[8px] uppercase font-black tracking-widest text-[var(--text-dimmed)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" /> MD
          </button>
        </div>
      }
    >
      <TextEditorContent
        editMode={editMode}
        content={localContent}
        onContentChange={handleContentChange}
        isReadOnly={isReadOnly}
        textareaRef={textareaRef}
        onToolbarAction={() => {}}
      />
    </FocusEditorShell>
  );
};

// Directory Overlay - uses same sidebar as Calendar
const DirectoryOverlay: React.FC = () => {
  // 1. State hooks
  const [groupBy, setGroupBy] = useState<GroupBy>('stack');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedThought, setSelectedThought] = useState<Thought | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stackFilter, setStackFilter] = useState<string | null>(null);
  
  // 2. Store hooks - always call
  const thoughts = useStore((state) => state.thoughts);
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);
  const stacks = useStore((state) => state.stacks);
  const isDemo = useStore((state) => state.isDemo);
  
  // Derived values from store - always compute
  const activeSpace = spaces.find(s => s.id === activeSpaceId);
  const isDirectoryMode = activeSpace?.mode === 'directory';
  
  // 3. Memo hooks - always compute (before any conditional)
  const textThoughts = useMemo(() => 
    thoughts.filter(t => t.type === 'text' && !t.deletedAt && t.spaceId === activeSpaceId),
    [thoughts, activeSpaceId]
  );

  // Filter by search and stack
  const filteredThoughts = useMemo(() => {
    let filtered = textThoughts;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.text?.toLowerCase().includes(q));
    }
    if (stackFilter) {
      filtered = filtered.filter(t => t.stackId === stackFilter);
    }
    return filtered;
  }, [textThoughts, searchQuery, stackFilter]);

  const groups = useMemo(() => {
    const groupMap = new Map<string, Group>();
    filteredThoughts.forEach(thought => {
      let groupId: string;
      let groupName: string;
      let groupColor: string | undefined;

      if (groupBy === 'stack') {
        groupId = thought.stackId || 'unstacked';
        const stack = stacks.find(s => s.id === thought.stackId);
        groupName = stack?.name || 'Unstacked';
        groupColor = stack?.color;
      } else if (groupBy === 'status') {
        groupId = thought.status || 'none';
        groupName = thought.status === 'done' ? 'Done' : 'Open';
      } else {
        const date = new Date(thought.createdAt || Date.now());
        groupId = `${date.getFullYear()}-${date.getMonth()}`;
        groupName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }

      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, { id: groupId, name: groupName, color: groupColor, thoughts: [] });
      }
      groupMap.get(groupId)!.thoughts.push({
        id: thought.id,
        text: thought.text,
        type: thought.type,
        status: thought.status
      });
    });

    return Array.from(groupMap.values()).sort((a, b) => {
      if (groupBy === 'date') return parseInt(b.id) - parseInt(a.id);
      return a.name.localeCompare(b.name);
    });
  }, [filteredThoughts, groupBy, stacks]);

  // 4. Conditional return AFTER all hooks
  if (!isDirectoryMode) {
    return <div style={{ display: 'none' }} />;
  }

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClose = () => setSelectedThought(null);

  return (
    <div className={cn(
      "directory-overlay inset-0 flex flex-col md:flex-row pointer-events-none p-4 md:p-10 pb-[100px] md:pb-[120px] pt-[64px] md:pt-[96px] gap-4 md:gap-5 opacity-100 transition-opacity duration-400 z-[10] overflow-hidden",
      isDemo ? "absolute" : "fixed"
    )}>
      {/* Sidebar - same as Calendar */}
      <SidebarLayout
        header={
          <div className="p-4 md:p-5 border-b border-[var(--glass-border)] text-[9px] md:text-[10px] font-black tracking-[0.2em] uppercase text-[var(--accent)] bg-[var(--glass-bg)] z-[40] sticky top-0 shadow-[var(--shadow-elevation-2)]">
            Directory
          </div>
        }
        filterBar={
          <DirectoryFilterBar 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            stackFilter={stackFilter}
            setStackFilter={setStackFilter}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
          />
        }
      >
        {/* Group List */}
        {groups.map(group => (
          <div key={group.id} className="mb-2">
            <button
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--glass-bg)] transition-colors"
            >
              {expandedGroups.has(group.id) ? (
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              )}
              <FolderOpen className="w-4 h-4" style={{ color: group.color || 'var(--text-muted)' }} />
              <span className="text-[11px] font-medium text-[var(--text-primary)] flex-1 text-left truncate">{group.name}</span>
              <span className="text-[9px] text-[var(--text-muted)]">{group.thoughts.length}</span>
            </button>
            
            {expandedGroups.has(group.id) && (
              <div className="ml-6 mt-1 space-y-1">
                {group.thoughts.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      const thought = filteredThoughts.find(t => t.id === item.id);
                      if (thought) setSelectedThought(thought);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--glass-bg)] transition-colors text-left"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                    <span className="text-[10px] text-[var(--text-secondary)] truncate flex-1">{item.text || 'Untitled'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {groups.length === 0 && (
          <div className="text-center p-8">
            <p className="text-[11px] text-[var(--text-muted)]">No thoughts found</p>
          </div>
        )}
      </SidebarLayout>

      {/* Main Content Area - only show when thought is selected */}
      {selectedThought && (
        <div className="directory-main flex-1 flex flex-col min-h-[400px] md:min-h-0 glass rounded-2xl overflow-hidden pointer-events-auto z-[5] relative border border-[var(--glass-border)] shadow-xl bg-[var(--bg-page)]/60 backdrop-blur-md">
          <DirectoryFocusEditor thought={selectedThought} onClose={handleClose} />
        </div>
      )}
    </div>
  );
};

export default DirectoryOverlay;