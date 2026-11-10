import { createStore } from 'zustand/vanilla';

import type { SortingState } from '@tanstack/table-core';

interface SetlistListState {
  /** Data Table sorting (default: date, newest first; undated last). */
  sorting: SortingState;
  setSorting: (s: SortingState) => void;
  showNew: boolean;
  name: string;
  date: string;
  startTime: string;
  vibe: boolean;
  /** Setlist id awaiting delete confirmation. */
  deleteId: string | null;
  setDeleteId: (id: string | null) => void;
  setShowNew: (v: boolean) => void;
  setField: (patch: Partial<Pick<SetlistListState, 'name' | 'date' | 'startTime' | 'vibe'>>) => void;
  resetForm: () => void;
}

const emptyForm = { name: '', date: '', startTime: '', vibe: true };

/** UI state of the setlists list page: the "new setlist" form. */
export const setlistListStore = createStore<SetlistListState>(set => ({
  sorting: [{ id: 'date', desc: true }],
  setSorting: sorting => set({ sorting }),
  showNew: false,
  ...emptyForm,
  deleteId: null,
  setDeleteId: deleteId => set({ deleteId }),
  setShowNew: showNew => set({ showNew }),
  setField: patch => set(patch),
  resetForm: () => set({ ...emptyForm, showNew: false }),
}));
