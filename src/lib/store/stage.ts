import { browser } from '$app/environment';
import { createStore } from 'zustand/vanilla';
import { derived } from 'svelte/store';
import { currentUser } from '$lib/auth';
import type { Category, SetlistEntry } from '$lib/types';
import type { LyricsPair } from '$lib/lyricsLayout';

export type StageSortKey = 'artist' | 'title' | 'default';

const MUSICIAN_KEY = 'kittens_stage_musician';

interface StageState {
  setlistId: string;
  setSetlistId: (id: string) => void;
  categoryFilter: Set<Category>;
  sortKey: StageSortKey;
  onlyWithComment: boolean;
  selectedMusician: string;
  filterOpen: boolean;
  unplayedToBottom: boolean;
  /** songId of the setlist entry whose lyrics are open (the entry comes from the setlist query). */
  lyricsSongId: string | null;
  now: Date;
  setCategoryFilter: (v: Set<Category>) => void;
  setSelectedMusician: (v: string) => void;
  toggleFilterOpen: () => void;
  toggleUnplayedToBottom: () => void;
  setLyricsSong: (songId: string | null) => void;
  tick: () => void;
  reset: () => void;
}

/** UI state of the stage view (filters, panels, lyrics overlay target, clock). */
export const stageStore = createStore<StageState>((set, get) => ({
  setlistId: '',
  setSetlistId: setlistId => set({ setlistId }),
  categoryFilter: new Set<Category>(),
  sortKey: 'default',
  onlyWithComment: false,
  selectedMusician: browser ? (localStorage.getItem(MUSICIAN_KEY) ?? '') : '',
  filterOpen: false,
  unplayedToBottom: false,
  lyricsSongId: null,
  now: new Date(),
  setCategoryFilter: categoryFilter => set({ categoryFilter }),
  setSelectedMusician: selectedMusician => set({ selectedMusician }),
  toggleFilterOpen: () => set({ filterOpen: !get().filterOpen }),
  toggleUnplayedToBottom: () => set({ unplayedToBottom: !get().unplayedToBottom }),
  setLyricsSong: lyricsSongId => set({ lyricsSongId }),
  tick: () => set({ now: new Date() }),
  // selectedMusician is persisted and intentionally survives a reset
  reset: () => set({
    categoryFilter: new Set<Category>(), sortKey: 'default', onlyWithComment: false,
    filterOpen: false, unplayedToBottom: false, lyricsSongId: null, now: new Date(),
  }),
}));

stageStore.subscribe((s, prev) => {
  if (browser && s.selectedMusician !== prev.selectedMusician) localStorage.setItem(MUSICIAN_KEY, s.selectedMusician);
});

// ── Lyrics overlay ──────────────────────────────────────────────────────────

const HIDE_CHORDS_KEY = 'lyrics_hide_chords';

interface LyricsState {
  hideChords: boolean;
  transpose: number;
  userFontSize: number | null;
  dropdownOpen: boolean;
  autoFontSize: number;
  columns: number;
  renderedColumns: LyricsPair[][];
  currentPage: number;
  hasPagination: boolean;
}

/** UI state of the lyrics overlay (the hide-chords toggle is persisted). */
export const lyricsStore = createStore<LyricsState>(() => ({
  hideChords: browser && localStorage.getItem(HIDE_CHORDS_KEY) === 'true',
  transpose: 0,
  userFontSize: null,
  dropdownOpen: false,
  autoFontSize: 12,
  columns: 1,
  renderedColumns: [[]],
  currentPage: 0,
  hasPagination: false,
}));

lyricsStore.subscribe((s, prev) => {
  if (browser && s.hideChords !== prev.hideChords) localStorage.setItem(HIDE_CHORDS_KEY, String(s.hideChords));
});

/** Admins and approved writers can mark songs as played on the stage. */
export const stageCanMark = derived(currentUser, u => u?.isAdmin === true || (u?.status === 'approved' && u?.role === 'writer'));
export const stageIsApproved = derived(currentUser, u => u?.status === 'approved');

// ── Add-songs modal ─────────────────────────────────────────────────────────

import type { Song } from '$lib/types';

interface AddSongsState {
  search: string;
  categoryFilter: Set<Category>;
  selected: Map<string, Song>;
  setSearch: (v: string) => void;
  setCategoryFilter: (v: Set<Category>) => void;
  toggle: (song: Song) => void;
  reset: () => void;
}

/** UI state of the add-songs picker (search, category filter, selection). */
export const addSongsStore = createStore<AddSongsState>((set, get) => ({
  search: '',
  categoryFilter: new Set<Category>(),
  selected: new Map<string, Song>(),
  setSearch: search => set({ search }),
  setCategoryFilter: categoryFilter => set({ categoryFilter }),
  toggle: song => {
    const next = new Map(get().selected);
    if (next.has(song.id)) next.delete(song.id); else next.set(song.id, song);
    set({ selected: next });
  },
  reset: () => set({ search: '', categoryFilter: new Set<Category>(), selected: new Map<string, Song>() }),
}));

// ── Comment input (one store per input instance) ────────────────────────────

interface CommentDraftState {
  value: string;
  focused: boolean;
  setValue: (v: string) => void;
  setFocused: (v: boolean) => void;
}

export function createCommentDraftStore(initial: string) {
  return createStore<CommentDraftState>(set => ({
    value: initial,
    focused: false,
    setValue: value => set({ value }),
    setFocused: focused => set({ focused }),
  }));
}
