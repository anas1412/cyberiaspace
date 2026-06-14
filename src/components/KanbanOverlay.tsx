import React, { useState, useRef, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import { DEFAULT_KANBAN_COLUMNS } from '../db';
import { Plus, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Column index 0 = sidebar (status: 'none')
 * Column index 1 = status: 'todo'
 * Column index 2 = status: 'doing'
 * Column index 3 = status: 'done'
 * Column index 4+ = status: 'none' (extends to dynamic columns)
 */
const columnIndexToStatus = (index: number): 'none' | 'todo' | 'doing' | 'done' => {
  if (index === 0) return 'none';
  if (index === 1) return 'todo';
  if (index === 2) return 'doing';
  if (index === 3) return 'done';
  return 'none';
};

const KanbanOverlay: React.FC = () => {
  // ─── Store Selectors ──────────────────────────────
  const activeSpaceId = useStore((s) => s.activeSpaceId);
  const spaces = useStore((s) => s.spaces);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const thoughts = useStore((s) => s.thoughts);
  const isDemo = useStore((s) => s.isDemo);
  const isReadOnly = useStore((s) => s.isReadOnly);
  const updateSpace = useStore((s) => s.updateSpace);
  const showArchived = useStore((s) => s.showArchived);

  // ─── Local State ──────────────────────────────────
  const [editingColIdx, setEditingColIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const visibleThoughts = useMemo(() => {
    return thoughts.filter((t) => {
      if (t.deletedAt) return false;
      if (t.spaceId !== activeSpaceId) return false;
      if (t.archivedAt && !showArchived) return false;
      return true;
    });
  }, [thoughts, activeSpaceId, showArchived]);

  // ─── Early return (after all hooks) ───────────────
  if (activeSpace?.mode !== 'kanban') return null;

  // ─── Derived Data ─────────────────────────────────
  const kanbanColumns = activeSpace?.kanbanColumns ?? DEFAULT_KANBAN_COLUMNS;
  const sidebarName = kanbanColumns[0] ?? 'Unplanned';
  const displayColumns = kanbanColumns.slice(1);

  const getThoughtCountForColumn = (colIndex: number): number => {
    if (colIndex >= 4) {
      // Extra columns: filter by kanbanCol instead of shared status ('none')
      return visibleThoughts.filter((t) => t.kanbanCol === colIndex).length;
    }
    const status = columnIndexToStatus(colIndex);
    return visibleThoughts.filter((t) => t.status === status).length;
  };

  // ─── Inline Edit Handlers ─────────────────────────
  const handleStartRename = (colIdx: number) => {
    if (isReadOnly) return;
    setEditingColIdx(colIdx);
    setEditValue(kanbanColumns[colIdx] ?? '');
  };

  const handleFinishRename = () => {
    if (editingColIdx === null || !activeSpaceId) {
      setEditingColIdx(null);
      return;
    }
    const trimmed = editValue.trim();
    const currentName = kanbanColumns[editingColIdx];
    if (trimmed && trimmed !== currentName) {
      const newColumns = [...kanbanColumns];
      newColumns[editingColIdx] = trimmed;
      updateSpace(activeSpaceId, { kanbanColumns: newColumns });
    }
    setEditingColIdx(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishRename();
    }
    if (e.key === 'Escape') {
      setEditingColIdx(null);
    }
  };

  // ─── Column CRUD ──────────────────────────────────
  const handleAddColumn = () => {
    if (!activeSpaceId || isReadOnly) return;
    updateSpace(activeSpaceId, {
      kanbanColumns: [...kanbanColumns, 'New Column'],
    });
  };

  const handleDeleteColumn = (colIdx: number, name: string) => {
    if (isReadOnly || !activeSpaceId) return;
    const { openModal } = useModalStore.getState();
    openModal({
      title: `Delete "${name}"?`,
      description: 'Thoughts in this column will be moved to Unplanned.',
      type: 'alert',
      confirmText: 'Delete Column',
      onConfirm: () => {
        if (!activeSpaceId) return;
        const newColumns = kanbanColumns.filter((_, i) => i !== colIdx);
        updateSpace(activeSpaceId, { kanbanColumns: newColumns });

        // Move all thoughts in the deleted column back to Unplanned (no orphans)
        const store = useStore.getState();
        const toMove = store.thoughts.filter(t => {
          if (t.spaceId !== activeSpaceId || t.deletedAt) return false;
          // Columns 4+ are tracked by kanbanCol; 0-3 by status
          if (colIdx >= 4) return t.kanbanCol === colIdx;
          return t.status === columnIndexToStatus(colIdx);
        });
        if (toMove.length > 0) {
          store.updateThoughts(
            toMove.map(t => t.id),
            { status: 'none', kanbanCol: undefined },
          );
        }
      },
    });
  };

  // ─── Render ───────────────────────────────────────
  return (
    <div
      className={cn(
        'kanban-overlay inset-0 flex flex-col md:flex-row pointer-events-none z-[10] opacity-100 transition-opacity duration-400 p-4 md:p-10 pb-[100px] md:pb-[120px] pt-[64px] md:pt-[96px] gap-4 md:gap-5',
        isDemo ? 'absolute' : 'fixed',
      )}
    >
      {/* ─── Sidebar (column index 0) ─────────────── */}
      <div
        className="kanban-sidebar w-full md:w-[260px] min-h-[200px] md:min-h-0 rounded-2xl flex flex-col overflow-hidden pointer-events-auto z-[30] relative border border-[var(--glass-border)] shadow-2xl"
        style={{ background: 'var(--bg-page)' }}
      >
        <div className="kanban-sidebar-header px-4 md:px-5 py-3 md:py-4 border-b border-[var(--glass-border)] text-[9px] md:text-[10px] font-black tracking-[0.2em] uppercase text-[var(--accent)] z-[40] sticky top-0 shadow-[var(--shadow-elevation-2)]">
          <span>{sidebarName}</span>
        </div>
        <div
          id="kanban-sidebar-content"
          className="kanban-sidebar-content flex-1 overflow-y-auto overflow-x-hidden relative p-4 md:p-5 custom-scroll overscroll-y-contain"
        >
          <div id="kanban-sidebar-spacer" style={{ height: '0px' }} />
          {getThoughtCountForColumn(0) === 0 && (
            <div className="flex items-center justify-center border-2 border-dashed border-[var(--glass-border)]/30 rounded-lg h-24 mt-4">
              <span className="text-[11px] text-[var(--text-muted)]">Drop here</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Main Columns ─────────────────────────── */}
      <div className="kanban-main flex-1 flex flex-col min-h-[400px] md:min-h-0 glass backdrop-blur-xl rounded-2xl overflow-hidden pointer-events-auto z-[5] relative border border-[var(--glass-border)] shadow-xl">
        {/* Shared grid template — keeps headers & content aligned */}
        {(() => {
          const colTemplate = `repeat(${displayColumns.length}, minmax(0, 1fr)) ${!isReadOnly ? '44px' : ''}`;

          return (
            <>
              {/* Column Headers — same grid template as content */}
              <div
                className="grid border-b border-[var(--glass-border)] bg-[var(--glass-bg)]"
                style={{ gridTemplateColumns: colTemplate, height: '50px', minHeight: '50px' }}
              >
                {displayColumns.map((name, i) => {
                  const colIdx = i + 1;
                  const isLast = i === displayColumns.length - 1;
                  return (
                    <div
                      key={colIdx}
                      className={cn(
                        'flex items-center justify-center border-r border-dashed border-[var(--glass-border)] relative group overflow-hidden',
                        isLast && 'border-r-0',
                      )}
                    >
                      {editingColIdx === colIdx ? (
                        <input
                          ref={editInputRef}
                          autoFocus
                          className="w-[90%] bg-[var(--bg-page)] text-[10px] md:text-[11px] font-black text-[var(--accent)] tracking-[0.15em] uppercase text-center rounded-lg px-2 py-1 border border-[var(--glass-border)] outline-none focus:border-[var(--accent)]"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleFinishRename}
                          onKeyDown={handleRenameKeyDown}
                        />
                      ) : (
                        <>
                          <button
                            className="text-[10px] md:text-[11px] font-black text-[var(--accent)] tracking-[0.15em] uppercase text-center hover:opacity-80 transition-opacity truncate max-w-[85%]"
                            onClick={() => handleStartRename(colIdx)}
                            title="Click to rename"
                          >
                            {name}
                          </button>
                          {!isReadOnly && displayColumns.length > 1 && (
                            <button
                              className="absolute top-1.5 right-1.5 w-4 h-4 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteColumn(colIdx, name);
                              }}
                              aria-label={`Delete ${name}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

                {/* Add column button (header — 44px column) */}
                {!isReadOnly && (
                  <div className="flex items-center justify-center">
                    <button
                      onClick={handleAddColumn}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                      aria-label="Add column"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Column Content — same grid template as headers */}
              <div
                id="kanban-column-content"
                className="grid overflow-y-auto relative custom-scroll overscroll-y-contain"
                style={{ gridTemplateColumns: colTemplate, flex: 1 }}
              >
                {displayColumns.length === 0 && !isReadOnly ? (
                  <div className="col-span-full flex items-center justify-center text-[var(--text-muted)] text-sm">
                    Click + to add a column
                  </div>
                ) : (
                  displayColumns.map((_name, i) => {
                    const colIdx = i + 1;
                    const colEmpty = getThoughtCountForColumn(colIdx) === 0;

                    return (
                      <div
                        key={colIdx}
                        className={cn(
                          'col-section flex flex-col relative min-h-[200px]',
                          i < displayColumns.length - 1 &&
                            'border-r border-dashed border-[var(--glass-border)]',
                        )}
                      >
                        {/* Empty state placeholder */}
                        {colEmpty && (
                          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-[var(--glass-border)]/30 rounded-lg mx-3 mt-3 mb-2 min-h-[100px]">
                            <span className="text-[11px] text-[var(--text-muted)]">Drop here</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Invisible spacer to match header's 44px add-column column */}
                {!isReadOnly && displayColumns.length > 0 && (
                  <div />
                )}

                {/* Physics spacer for kanban column scroll height */}
                <div
                  id="kanban-column-spacer"
                  className="absolute bottom-0 left-0 right-0"
                  style={{ height: '0px' }}
                />
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
};

export default KanbanOverlay;
