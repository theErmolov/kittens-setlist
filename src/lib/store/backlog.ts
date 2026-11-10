import { createStore } from 'zustand/vanilla';
import type { SortingState } from '@tanstack/table-core';
import type { Song, Category, Instrument, MusicianRole, BandMusician, LearningStage } from '$lib/types';

const toggled = <T>(set: Set<T>, v: T): Set<T> => {
  const next = new Set(set);
  next.has(v) ? next.delete(v) : next.add(v);
  return next;
};

interface BacklogState {
  search: string;
  categoryFilter: Set<Category>;
  selectedMusicians: Set<string>;
  selectedInstruments: Set<Instrument>;
  showProgress: boolean;
  showArchived: boolean;
  filterOpen: boolean;
  /** Desktop filter popover (the mobile drawer uses `filterOpen`). */
  filterPopoverOpen: boolean;
  additionMode: boolean;
  /** Song ids currently showing the green "added" flash. */
  flashing: Set<string>;
  /** TanStack sorting state; single-column, never unsorted (clicking flips asc/desc or switches column). */
  sorting: SortingState;
  showAddModal: boolean;
  /** Narrow table view: header and rows split into two lines (song info, then people) instead of scrolling sideways. */
  compact: boolean;
  setCompact: (v: boolean) => void;
  /** Song ids (the song itself comes from the catalog query). */
  editingSongId: string | null;
  addToSetlistSongId: string | null;
  lyricsViewSongId: string | null;
  /** Requests handled by SongTable (which owns the mutations). */
  addRequest: string | null;
  deleteRequest: string | null;

  setSearch: (v: string) => void;
  setCategoryFilter: (v: Set<Category>) => void;
  toggleMusician: (name: string) => void;
  setSelectedMusicians: (v: string[]) => void;
  setSelectedInstruments: (v: Instrument[]) => void;
  setFilterOpen: (v: boolean) => void;
  setFilterPopoverOpen: (v: boolean) => void;
  toggleCategory: (c: Category) => void;
  resetFilters: () => void;
  toggleInstrument: (inst: Instrument) => void;
  toggleShowProgress: () => void;
  toggleShowArchived: () => void;
  toggleFilterOpen: () => void;
  toggleAdditionMode: () => void;
  toggleSort: (id: string) => void;
  setSorting: (v: SortingState) => void;
  setShowAddModal: (v: boolean) => void;
  setEditingSong: (id: string | null) => void;
  setAddToSetlistSong: (id: string | null) => void;
  setLyricsViewSong: (id: string | null) => void;
  requestAdd: (id: string | null) => void;
  requestDelete: (id: string | null) => void;
  flashSong: (id: string) => void;
}

export const backlogStore = createStore<BacklogState>((set, get) => ({
  search: '',
  categoryFilter: new Set(),
  selectedMusicians: new Set(),
  selectedInstruments: new Set(),
  showProgress: false,
  showArchived: false,
  filterOpen: false,
  filterPopoverOpen: false,
  additionMode: false,
  flashing: new Set(),
  sorting: [{ id: 'artist', desc: false }],
  showAddModal: false,
  compact: false,
  setCompact: compact => set({ compact }),
  editingSongId: null,
  addToSetlistSongId: null,
  lyricsViewSongId: null,
  addRequest: null,
  deleteRequest: null,

  setSearch: search => set({ search }),
  setCategoryFilter: categoryFilter => set({ categoryFilter }),
  setSelectedMusicians: v => set({ selectedMusicians: new Set(v) }),
  setSelectedInstruments: v => set({ selectedInstruments: new Set(v) }),
  setFilterOpen: filterOpen => set({ filterOpen }),
  setFilterPopoverOpen: filterPopoverOpen => set({ filterPopoverOpen }),
  toggleCategory: c => set(s => ({ categoryFilter: toggled(s.categoryFilter, c) })),
  resetFilters: () => set({ search: '', showArchived: false, categoryFilter: new Set(), selectedMusicians: new Set(), selectedInstruments: new Set() }),
  toggleMusician: name => set(s => ({ selectedMusicians: toggled(s.selectedMusicians, name) })),
  toggleInstrument: inst => set(s => ({ selectedInstruments: toggled(s.selectedInstruments, inst) })),
  toggleShowProgress: () => set(s => ({ showProgress: !s.showProgress })),
  toggleShowArchived: () => set(s => ({ showArchived: !s.showArchived })),
  toggleFilterOpen: () => set(s => ({ filterOpen: !s.filterOpen })),
  toggleAdditionMode: () => set(s => ({ additionMode: !s.additionMode })),
  toggleSort: id => set(s => ({ sorting: [{ id, desc: s.sorting[0]?.id === id ? !s.sorting[0].desc : false }] })),
  setSorting: sorting => set({ sorting }),
  setShowAddModal: showAddModal => set({ showAddModal }),
  setEditingSong: editingSongId => set({ editingSongId }),
  setAddToSetlistSong: addToSetlistSongId => set({ addToSetlistSongId }),
  setLyricsViewSong: lyricsViewSongId => set({ lyricsViewSongId }),
  requestAdd: addRequest => set({ addRequest }),
  requestDelete: deleteRequest => set({ deleteRequest }),
  flashSong: id => {
    set(s => ({ flashing: new Set(s.flashing).add(id) }));
    setTimeout(() => {
      const next = new Set(get().flashing);
      next.delete(id);
      set({ flashing: next });
    }, 1000);
  },
}));

// ── Song edit modal draft ────────────────────────────────────────────────────

export type GuestRow = { id: number; name: string; instruments: Instrument[]; progress: LearningStage };
export type SongDraftMode = 'backlog' | 'entry' | 'setlist-only';

let guestId = 0;
const mkGuest = (name = '', instruments: Instrument[] = [], progress: LearningStage = 'queue'): GuestRow =>
  ({ id: guestId++, name, instruments, progress });

interface SongEditState {
  draft: Song;
  guestRows: GuestRow[];
  activeTab: 'details' | 'lyrics';
  saving: boolean;
  saveFailed: boolean;
  /** Which in-modal confirmation (AlertDialog) is showing. */
  confirm: 'delete' | 'remove' | null;

  init: (song: Partial<Song> | null, musicians: BandMusician[], mode: SongDraftMode) => void;
  setField: <K extends keyof Song>(key: K, value: Song[K]) => void;
  setActiveTab: (tab: 'details' | 'lyrics') => void;
  toggleInstrument: (name: string, inst: Instrument) => void;
  setInstruments: (name: string, instruments: Instrument[]) => void;
  setGuestInstruments: (id: number, instruments: Instrument[]) => void;
  setProgress: (name: string, stage: LearningStage) => void;
  setGuestName: (id: number, value: string) => void;
  toggleGuestInstrument: (id: number, inst: Instrument) => void;
  setGuestProgress: (id: number, stage: LearningStage) => void;
  removeGuest: (id: number) => void;
  setSaving: (v: boolean) => void;
  setSaveFailed: (v: boolean) => void;
  setConfirm: (v: 'delete' | 'remove' | null) => void;
}

export const songEditStore = createStore<SongEditState>((set) => ({
  draft: { id: '', artist: '', title: '', category: 'mid', comment: '', musicians: {}, lengthMinutes: 5 } as Song,
  guestRows: [],
  activeTab: 'details',
  saving: false,
  saveFailed: false,
  confirm: null,

  init: (song, musicians, mode) => {
    const permanentNames = new Set(musicians.map(m => m.name));
    const roster: Record<string, MusicianRole> = {};
    if (song?.musicians) {
      for (const [name, role] of Object.entries(song.musicians)) {
        if (permanentNames.has(name)) roster[name] = { instruments: [...(role.instruments ?? [])] };
      }
    } else if (mode !== 'setlist-only') {
      for (const m of musicians) {
        roster[m.name] = { instruments: m.defaultInstruments?.length ? [...m.defaultInstruments] : [] };
      }
    }
    let guests: GuestRow[];
    if (!song?.musicians) guests = [mkGuest()];
    else {
      guests = Object.entries(song.musicians)
        .filter(([name]) => !permanentNames.has(name))
        .map(([name, role]) => mkGuest(name, [...(role.instruments ?? [])], song.progress?.[name] ?? 'queue'));
      guests.push(mkGuest());
    }
    set({
      draft: {
        id: song?.id ?? '',
        artist: song?.artist ?? '',
        title: song?.title ?? '',
        category: song?.category ?? 'mid',
        comment: song?.comment ?? '',
        personalComment: song?.personalComment ?? '',
        musicians: roster,
        sortOrder: song?.sortOrder,
        lengthMinutes: song?.lengthMinutes ?? 5,
        progress: { ...(song?.progress ?? {}) },
        lyrics: song?.lyrics ?? '',
        transpose: song?.transpose,
        archived: song?.archived ?? false,
      },
      guestRows: guests,
      activeTab: 'details',
      saving: false,
      saveFailed: false,
      confirm: null,
    });
  },

  setField: (key, value) => set(s => ({ draft: { ...s.draft, [key]: value } })),
  setActiveTab: activeTab => set({ activeTab }),

  toggleInstrument: (name, inst) => set(s => {
    const role = s.draft.musicians[name] ?? { instruments: [] };
    const has = role.instruments.includes(inst);
    const instruments = has ? role.instruments.filter(i => i !== inst) : [...role.instruments, inst];
    return { draft: { ...s.draft, musicians: { ...s.draft.musicians, [name]: { instruments } } } };
  }),
  setInstruments: (name, instruments) => set(s => ({
    draft: { ...s.draft, musicians: { ...s.draft.musicians, [name]: { instruments } } },
  })),
  setGuestInstruments: (id, instruments) => set(s => ({ guestRows: s.guestRows.map(r => r.id === id ? { ...r, instruments } : r) })),
  setProgress: (name, stage) => set(s => ({ draft: { ...s.draft, progress: { ...(s.draft.progress ?? {}), [name]: stage } } })),

  setGuestName: (id, value) => set(s => {
    const isLast = id === s.guestRows[s.guestRows.length - 1].id;
    let rows = s.guestRows.map(r => r.id === id ? { ...r, name: value } : r);
    if (isLast && value.trim()) rows = [...rows, mkGuest()];
    return { guestRows: rows };
  }),
  toggleGuestInstrument: (id, inst) => set(s => ({
    guestRows: s.guestRows.map(r => r.id !== id ? r : {
      ...r, instruments: r.instruments.includes(inst) ? r.instruments.filter(i => i !== inst) : [...r.instruments, inst],
    }),
  })),
  setGuestProgress: (id, progress) => set(s => ({ guestRows: s.guestRows.map(r => r.id === id ? { ...r, progress } : r) })),
  removeGuest: id => set(s => {
    let rows = s.guestRows.filter(r => r.id !== id);
    if (!rows.length || rows[rows.length - 1].name.trim()) rows = [...rows, mkGuest()];
    return { guestRows: rows };
  }),
  setSaving: saving => set({ saving }),
  setSaveFailed: saveFailed => set({ saveFailed }),
  setConfirm: confirm => set({ confirm }),
}));
