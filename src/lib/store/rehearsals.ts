/**
 * UI state for the rehearsals area: list page (calendar, new-rehearsal modal),
 * detail page (modals, drag, notes, busy/error) and the plan form drafts.
 */
import { createStore } from 'zustand/vanilla';
import type { RehearsalDraft, RehearsalSong, Setlist, Song } from '$lib/types';
import { closestUpcomingSetlist, localDate, plannedRehearsalAttendees, upcomingSetlists } from '$lib/rehearsals';

const monthStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);

/* ---------- list page ---------- */
interface ListState {
  /** ISO day picked in the calendar; null = nothing selected (side panel shows the upcoming rehearsals). */
  selectedDate: string | null;
  month: Date;
  showNew: boolean;
  initial: Partial<RehearsalDraft>;
  reset: () => void;
  /** Calendar navigation: show `month` (the selection is left untouched). */
  setMonth: (month: Date) => void;
  /** Selects a day (also showing its month); picking the selected day again clears it. */
  selectDay: (date: Date) => void;
  clearDay: () => void;
  goToday: () => void;
  openNew: (initial: Partial<RehearsalDraft>) => void;
  closeNew: () => void;
}

export const rehearsalListStore = createStore<ListState>((set, get) => ({
  selectedDate: null,
  month: monthStart(),
  showNew: false,
  initial: {},
  reset: () => set({ selectedDate: null, month: monthStart(), showNew: false, initial: {} }),
  setMonth: target => {
    const month = monthStart(target);
    if (month.getTime() !== get().month.getTime()) set({ month });
  },
  selectDay: date => {
    const { month, selectedDate } = get();
    const iso = localDate(date);
    set({ selectedDate: iso === selectedDate ? null : iso, ...(date.getFullYear() !== month.getFullYear() || date.getMonth() !== month.getMonth() ? { month: monthStart(date) } : {}) });
  },
  clearDay: () => set({ selectedDate: null }),
  goToday: () => set({ month: monthStart() }),
  openNew: initial => set({ initial, showNew: true }),
  closeNew: () => set({ showNew: false }),
}));

/* ---------- detail page ---------- */
interface DetailState {
  busy: boolean;
  error: string;
  showForm: boolean;
  repeating: boolean;
  readinessFirst: boolean;
  /** Participants whose songs are shown (AND: every selected participant plays the song). */
  participantFilter: string[];
  filterOpen: boolean;
  /** Data Table column visibility (unused musician columns hidden). */
  columnVisibility: Record<string, boolean>;
  /** Cell whose readiness level is being picked (song key + musician name). */
  levelPicker: { key: string; name: string; anchor: HTMLElement } | null;
  /** Key (rehearsalSongKey) of the song whose lyrics are open; the song comes from the rehearsal query. */
  lyricsKey: string | null;
  /** Open confirmation dialog for destructive session actions. */
  confirm: 'cancel' | 'delete' | null;
  dragIndex: number | null;
  dropIndex: number | null;
  dragMoved: boolean;
  reset: () => void;
  patch: (p: Partial<Omit<DetailState, 'reset' | 'patch' | 'toggleParticipant' | 'resetFilters'>>) => void;
  toggleParticipant: (name: string) => void;
  resetFilters: () => void;
}

const detailInitial = {
  busy: false, error: '', showForm: false, repeating: false, readinessFirst: false, participantFilter: [] as string[], filterOpen: false, columnVisibility: {}, levelPicker: null, lyricsKey: null, confirm: null,
  dragIndex: null, dropIndex: null, dragMoved: false,
};

export const rehearsalDetailStore = createStore<DetailState>(set => ({
  ...detailInitial,
  reset: () => set({ ...detailInitial }),
  patch: p => set(p),
  toggleParticipant: name => set(s => ({ participantFilter: s.participantFilter.includes(name) ? s.participantFilter.filter(n => n !== name) : [...s.participantFilter, name] })),
  resetFilters: () => set({ participantFilter: [], readinessFirst: false }),
}));

/* ---------- plan form (create/edit/repeat) ---------- */
export const formatInputDate = (iso: string) => iso.split('-').reverse().join('.');
export const parseInputDate = (text: string) => text.split('.').reverse().join('-');

export type SelectionSource = 'setlist' | 'catalog' | 'selected';

interface FormState {
  seed: Partial<RehearsalDraft>;
  timeZone: string;
  dateText: string;
  startTime: string;
  location: string;
  note: string;
  autoSelect: boolean;
  setlistId: string;
  songs: RehearsalSong[];
  attendanceOverrides: Record<string, boolean>;
  busy: boolean;
  error: string;
  /** Calendar popover next to the DD.MM.YYYY field. */
  datePickerOpen: boolean;
  source: SelectionSource;
  search: string;
  guest: string;
  guests: string[];
  init: (seed: Partial<RehearsalDraft>, setlists: Setlist[]) => void;
  patch: (p: Partial<Omit<FormState, 'init' | 'patch' | 'toggle' | 'addGuest' | 'chooseMusicians' | 'toggleAttendee'>>) => void;
  toggle: (item: RehearsalSong) => void;
  toggleAttendee: (name: string) => void;
  chooseMusicians: (names: string[], included: boolean) => void;
  addGuest: () => void;
}

export const selectAttendees = (s: Pick<FormState, 'seed' | 'songs' | 'attendanceOverrides'>): string[] =>
  s.seed.cancelled ? s.seed.attendees ?? [] : plannedRehearsalAttendees(s.songs, s.attendanceOverrides);

export const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

export const rehearsalFormStore = createStore<FormState>((set, get) => ({
  seed: {}, timeZone: '', dateText: '', startTime: '19:00', location: '', note: '', autoSelect: false, setlistId: '',
  songs: [], attendanceOverrides: {}, busy: false, error: '', datePickerOpen: false, source: 'catalog', search: '', guest: '', guests: [],
  init: (seed, setlists) => {
    const dateText = formatInputDate(seed.date ?? localDate());
    const startTime = seed.startTime ?? '19:00';
    const autoSelect = seed.setlistId === undefined && seed.attendees === undefined && seed.songs === undefined;
    const setlistId = seed.setlistId ?? (autoSelect ? closestUpcomingSetlist(upcomingSetlists(setlists), parseInputDate(dateText), startTime)?.id ?? '' : '');
    let attendanceOverrides: Record<string, boolean> = {};
    if (seed.attendees) {
      const needed = new Set((seed.songs ?? []).flatMap(item => Object.keys(item.song.musicians).filter(n => item.song.musicians[n].instruments.length > 0)));
      attendanceOverrides = Object.fromEntries([
        ...[...needed].filter(name => !seed.attendees!.includes(name)).map(name => [name, false]),
        ...seed.attendees.filter(name => !needed.has(name)).map(name => [name, true]),
      ]);
    }
    set({
      seed, timeZone: seed.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateText, startTime, location: seed.location ?? '', note: seed.note ?? '', autoSelect, setlistId,
      songs: seed.songs ? [...seed.songs] : [], attendanceOverrides, busy: false, error: '', datePickerOpen: false,
      source: setlists.some(s => s.id === setlistId) ? 'setlist' : 'catalog', search: '', guest: '', guests: [],
    });
  },
  patch: p => set(p),
  toggle: item => set(s => ({ songs: s.songs.some(x => x.songId === item.songId) ? s.songs.filter(x => x.songId !== item.songId) : [...s.songs, item] })),
  toggleAttendee: name => set(s => ({ attendanceOverrides: { ...s.attendanceOverrides, [name]: !selectAttendees(s).includes(name) } })),
  chooseMusicians: (names, included) => set(s => ({ attendanceOverrides: { ...s.attendanceOverrides, ...Object.fromEntries(names.map(name => [name, included])) } })),
  addGuest: () => {
    const name = get().guest.trim();
    if (!name) return;
    set(s => ({ guests: [...new Set([...s.guests, name])], attendanceOverrides: { ...s.attendanceOverrides, [name]: true }, guest: '' }));
  },
}));
