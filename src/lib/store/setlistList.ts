import { createStore } from 'zustand/vanilla';

import { localDate } from '$lib/rehearsals';

interface SetlistListState {
  showNew: boolean;
  name: string;
  date: string;
  startTime: string;
  vibe: boolean;
  /** Setlist id awaiting delete confirmation. */
  deleteId: string | null;
  setDeleteId: (id: string | null) => void;
  /** Calendar: day picked by clicking an empty day; prefills the date of a new setlist. */
  selectedIso: string | null;
  setSelectedIso: (iso: string | null) => void;
  /** Calendar: an ISO date inside the visible month. */
  monthIso: string;
  setMonthIso: (iso: string) => void;
  setShowNew: (v: boolean) => void;
  setField: (patch: Partial<Pick<SetlistListState, 'name' | 'date' | 'startTime' | 'vibe'>>) => void;
  resetForm: () => void;
}

const emptyForm = { name: '', date: '', startTime: '', vibe: true };

/** UI state of the setlists list page: the "new setlist" form. */
export const setlistListStore = createStore<SetlistListState>(set => ({
  showNew: false,
  ...emptyForm,
  deleteId: null,
  setDeleteId: deleteId => set({ deleteId }),
  selectedIso: null,
  setSelectedIso: selectedIso => set({ selectedIso }),
  monthIso: localDate(),
  setMonthIso: monthIso => set({ monthIso }),
  setShowNew: showNew => set({ showNew }),
  setField: patch => set(patch),
  resetForm: () => set({ ...emptyForm, showNew: false }),
}));
