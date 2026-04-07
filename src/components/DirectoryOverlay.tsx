import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { DirectorySidebar } from './DirectorySidebar';
import { DirectoryInlineEditor } from './DirectoryInlineEditor';
import { buildDirectoryGroups } from '../utils/treeTransformation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DirectoryOverlay: React.FC = () => {
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const directorySearchQuery = useStore((state) => state.directorySearchQuery);
  const directoryGroupBy = useStore((state) => state.directoryGroupBy);
  const directorySortBy = useStore((state) => state.directorySortBy);
  const isDemo = useStore((state) => state.isDemo);

  const groups = useMemo(
    () => buildDirectoryGroups(thoughts, stacks, directoryGroupBy, directorySortBy, directorySearchQuery, activeSpaceId ?? undefined),
    [thoughts, stacks, directoryGroupBy, directorySortBy, directorySearchQuery, activeSpaceId],
  );

  if (activeSpace?.mode !== 'directory') return null;

  return (
    <div
      className={cn(
        'directory-overlay inset-0 flex flex-col md:flex-row pointer-events-none z-[25] opacity-100 transition-opacity duration-400 p-4 md:p-10 pb-[100px] md:pb-[120px] pt-[64px] md:pt-[96px] gap-4 md:gap-5',
        isDemo ? 'absolute' : 'fixed',
      )}
    >
      {/* Left: Directory Sidebar (grouped list) */}
      <div
        className="directory-sidebar w-full md:w-[260px] h-full rounded-2xl flex flex-col overflow-hidden pointer-events-auto z-[30] relative border border-[var(--glass-border)] shadow-2xl"
        style={{ background: 'var(--bg-page)' }}
      >
        <DirectorySidebar groups={groups} />
      </div>

      {/* Right: Inline Focus Editor */}
      <div className="directory-main flex-1 min-h-[400px] md:min-h-0 glass backdrop-blur-xl rounded-2xl overflow-hidden pointer-events-auto z-[5] relative border border-[var(--glass-border)] shadow-xl">
        <DirectoryInlineEditor />
      </div>
    </div>
  );
};

export default DirectoryOverlay;
