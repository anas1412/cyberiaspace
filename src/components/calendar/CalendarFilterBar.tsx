import React from 'react';
import { useStore } from '../../store/useStore';
import { ViewFilterBar } from '../shared/ViewFilterBar';

export const CalendarFilterBar: React.FC = () => {
  const calendarSearchQuery = useStore((state) => state.calendarSearchQuery);
  const setCalendarSearchQuery = useStore((state) => state.setCalendarSearchQuery);
  const calendarStackFilter = useStore((state) => state.calendarStackFilter);
  const setCalendarStackFilter = useStore((state) => state.setCalendarStackFilter);

  return (
    <ViewFilterBar
      searchQuery={calendarSearchQuery}
      setSearchQuery={setCalendarSearchQuery}
      stackFilter={calendarStackFilter as string[] | null}
      setStackFilter={setCalendarStackFilter}
      layout="vertical"
    />
  );
};
