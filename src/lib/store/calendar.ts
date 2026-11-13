import { createStore } from 'zustand/vanilla';

interface CalendarState {
  /** The ISO date under the pointer, shared by the calendar days and the list items linked to them (setlists / rehearsals pages). */
  hoverIso: string | null;
  setHoverIso: (iso: string | null) => void;
}

/** UI state shared by every `EventCalendar` page. */
export const calendarStore = createStore<CalendarState>(set => ({
  hoverIso: null,
  setHoverIso: hoverIso => set({ hoverIso }),
}));
