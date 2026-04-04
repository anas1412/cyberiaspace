import React from 'react';
import { useStore } from '../../store/useStore';
import { ViewFilterBar } from '../shared/ViewFilterBar';

export const KanbanFilterBar: React.FC = () => {
  const kanbanSearchQuery = useStore((state) => state.kanbanSearchQuery);
  const setKanbanSearchQuery = useStore((state) => state.setKanbanSearchQuery);
  const kanbanStackFilter = useStore((state) => state.kanbanStackFilter);
  const setKanbanStackFilter = useStore((state) => state.setKanbanStackFilter);

  return (
    <ViewFilterBar
      searchQuery={kanbanSearchQuery}
      setSearchQuery={setKanbanSearchQuery}
      stackFilter={kanbanStackFilter as string[] | null}
      setStackFilter={setKanbanStackFilter}
      layout="vertical"
    />
  );
};
