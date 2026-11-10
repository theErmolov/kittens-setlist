/**
 * Setlist editor UI state (Zustand, vanilla).
 *
 * The setlist itself (entries / subsets / comment / meta) lives only in TanStack
 * Query (`setlistQuery`). This store keeps UI state (filters, modals, drag,
 * quick-set mode, drafts) plus `local`: a short-lived layout override that is
 * merged over the query result at read time (`effectiveLayout`). It is set when
 * a drag starts or a layout change is persisted, and released once the drag grace
 * period (`DRAG_GRACE_MS`) has passed and no save is in flight, so poll results
 * cannot jerk rows around mid-drag or revert a just-saved reorder.
 *
 * Invariant maintained by every layout mutation (via `persistLayout` ->
 * `normalizeSetlistLayout`): entries with a `subsetId` sit contiguously at the
 * top of `entries`, grouped in `subsets[]` order, followed by the unassigned
 * pool, and `order` is renumbered 0..N.
 *
 * Persistence and reading the cached setlist go through `deps`, registered by
 * the editor root component, so the actions stay free of API/query-client access.
 */
import { createStore } from 'zustand/vanilla';
import type { Setlist, SetlistEntry, SetlistSubset, Song, LearningStage } from '$lib/types';
import { sortSubset } from '$lib/subsetSort';
import { progressPct, STAGE_PCT } from '$lib/utils';
import {
  buildSetlistLayout, normalizeSetlistLayout, moveLayoutEntry, moveLayoutEntryToSubset,
  moveSubsetBlock, moveSubsetBlockBy, type SetlistLayoutItem,
} from '$lib/setlistLayout';

/** Poll results are deferred for this long after a drag ends. */
export const DRAG_GRACE_MS = 3000;

export interface SetlistMeta { name: string; date: string; startTime: string; vibe: boolean }

export interface EditorDeps {
  /** The cached server copy of the setlist being edited. */
  getServer: () => Setlist | undefined;
  reorder: (entries: SetlistEntry[], subsets: SetlistSubset[]) => Promise<Setlist>;
  updateSetlist: (setlist: Setlist) => Promise<Setlist>;
}

export type DropSide = 'before' | 'after';

export interface LocalLayout { entries: SetlistEntry[]; subsets: SetlistSubset[] }

interface EditorData {
  setlistId: string | null;
  /** Layout override merged over the query result while dragging / just after a save (see header). */
  local: LocalLayout | null;
  editingMeta: boolean;
  draftMeta: SetlistMeta;
  /** Data Table column visibility (unused musician columns / time column hidden). */
  columnVisibility: Record<string, boolean>;
  /** True while polling should be suspended (tab hidden / alone in the room / event long over). */
  pollPaused: boolean;
}

interface EditorUi {
  showAddModal: boolean;
  showSetlistOnlyModal: boolean;
  showBreakPicker: boolean;
  /** Setlist comment editor dialog. */
  editingComment: boolean;
  draftComment: string;
  editingBreakOrder: number | null;
  /** songId of the entry being edited / whose lyrics are open (the entry comes from the setlist query). */
  editingEntryId: string | null;
  lyricsViewEntryId: string | null;
  selectedMusician: string | null;
  filterNotReady: boolean;
  filterText: string;
  filterOpen: boolean;
  /** Quick-set mode: the subset being edited (tapping a song toggles its membership). */
  activeSubsetId: string | null;
  draftSubsetName: string;
  draggedEntryKey: string | null;
  overEntryKey: string | 'end' | null;
  overEntrySide: DropSide;
  draggedSubsetId: string | null;
  overSubsetId: string | null;
  overSubsetSide: DropSide;
  dragEndedAt: number;
  /** Viewport tier of the table (CSS hides time ≤1101px and musician/guest columns ≤700px); decides how many columns full-width rows span. */
  tier: 'mobile' | 'mid' | 'wide';
}

export type EditorState = EditorData & EditorUi & {
  deps: EditorDeps | null;
  setDeps: (deps: EditorDeps) => void;
  /** Generic UI setter for simple flags (modals, filter toggles, drafts). */
  patch: (partial: Partial<EditorUi & Pick<EditorData, 'pollPaused' | 'columnVisibility'>>) => void;

  reset: (setlistId: string) => void;
  /** Current entries/subsets: the query result with `local` merged over it. */
  view: () => LocalLayout;

  // meta
  startEditMeta: () => void;
  cancelEditMeta: () => void;
  setDraftMeta: (partial: Partial<SetlistMeta>) => void;
  saveMeta: () => Promise<void>;

  // filters
  toggleMusician: (name: string) => void;
  toggleFilterNotReady: () => void;
  toggleFilterOpen: () => void;

  // layout / subsets
  persistLayout: (layout: SetlistLayoutItem[]) => Promise<void>;
  newSubset: (defaultName: (n: number) => string) => Promise<void>;
  openSubsetEdit: (subset: SetlistSubset) => void;
  finishSubsetEdit: () => Promise<void>;
  dissolveSubset: (subsetId: string) => Promise<void>;
  moveSubset: (subsetId: string, targetSubsetId: string) => Promise<void>;
  moveSubsetBy: (subsetId: string, delta: -1 | 1) => Promise<void>;
  toggleSubsetMembership: (entry: SetlistEntry, canWrite: boolean) => Promise<void>;

  // drag and drop (state transitions only; DOM work stays in the table component)
  startEntryDrag: (key: string) => void;
  setOverEntry: (key: string | 'end' | null, side?: DropSide) => void;
  startSubsetDrag: (subsetId: string) => void;
  setOverSubset: (subsetId: string | null, side?: DropSide) => void;
  clearEntryDrag: () => void;
  clearSubsetDrag: () => void;
  dropEntry: () => Promise<void>;
  dropSubset: () => Promise<void>;
  dropEntryOnSubset: (subsetId: string) => Promise<void>;
  dropAtCurrentTarget: () => Promise<void>;
};

// ---------- pure helpers (exported for components and tests) ----------

export const entryKey = (entry: SetlistEntry): string => entry.songId ?? `break-${entry.order}`;

export const sortEntries = (entries: SetlistEntry[]): SetlistEntry[] => [...entries].sort((a, b) => a.order - b.order);

export function entryStage(entry: SetlistEntry, name: string): LearningStage {
  return (entry.song?.progress?.[name] ?? entry.progress?.[name] ?? 'queue') as LearningStage;
}

export function entryProgressPct(entry: SetlistEntry): number {
  if (!entry.song) return 0;
  const merged = Object.fromEntries(Object.keys(entry.song.musicians).map(n => [n, entryStage(entry, n)]));
  return progressPct(entry.song.musicians, merged);
}

export interface EntryFilter { selectedMusician: string | null; filterNotReady: boolean; filterText: string }

export function isFilterActive(f: EntryFilter): boolean {
  return f.selectedMusician !== null || f.filterNotReady || f.filterText.trim() !== '';
}

export function filterEntries(sorted: SetlistEntry[], f: EntryFilter): SetlistEntry[] {
  let entries = sorted;
  if (f.selectedMusician) {
    const m = f.selectedMusician;
    entries = entries
      .filter(e => {
        if (!e.song) return false; // hide breaks when musician filter active
        const role = e.song.musicians[m];
        return role && role.instruments.length > 0;
      })
      .sort((a, b) => STAGE_PCT[entryStage(a, m)] - STAGE_PCT[entryStage(b, m)]);
  }
  if (f.filterNotReady) {
    entries = entries
      .filter(e => (e.song ? entryProgressPct(e) < 100 : false)) // hide breaks
      .sort((a, b) => entryProgressPct(a) - entryProgressPct(b));
  }
  const q = f.filterText.trim().toLowerCase();
  if (q) {
    entries = entries.filter(e => {
      if (!e.song) return false;
      return e.song.artist.toLowerCase().includes(q)
        || e.song.title.toLowerCase().includes(q)
        || (e.comment ?? '').toLowerCase().includes(q);
    });
  }
  return entries;
}

export function subsetEntryCount(entries: SetlistEntry[], subsetId: string): number {
  return entries.filter(e => e.subsetId === subsetId && e.songId).length;
}

export function subsetPosition(entries: SetlistEntry[], subsets: SetlistSubset[], subsetId: string): number {
  return buildSetlistLayout(entries, subsets)
    .filter(item => item.kind === 'subset')
    .findIndex(item => item.kind === 'subset' && item.subset.id === subsetId);
}

export function subsetTotal(entries: SetlistEntry[], subsets: SetlistSubset[]): number {
  return buildSetlistLayout(entries, subsets).filter(item => item.kind === 'subset').length;
}

/**
 * Up to 2 songs (oldest->most recent) a subset should chain after: the tail of
 * the previous subset, or - for the first subset - the most recently played songs.
 */
export function computeAnchors(entries: SetlistEntry[], subsets: SetlistSubset[], subsetId: string): Song[] {
  const sorted = sortEntries(entries);
  const orderedSubsets = buildSetlistLayout(entries, subsets)
    .filter((item): item is Extract<SetlistLayoutItem, { kind: 'subset' }> => item.kind === 'subset')
    .map(item => item.subset);
  const idx = orderedSubsets.findIndex(s => s.id === subsetId);
  if (idx > 0) {
    const prevMembers = sorted.filter(e => e.subsetId === orderedSubsets[idx - 1].id);
    return prevMembers.slice(-2).map(e => e.song).filter((s): s is Song => !!s);
  }
  const played = sorted
    .filter(e => e.played && e.song)
    .sort((a, b) => {
      const at = a.playedAt ? Date.parse(a.playedAt) : -Infinity;
      const bt = b.playedAt ? Date.parse(b.playedAt) : -Infinity;
      return at !== bt ? at - bt : a.order - b.order;
    });
  return played.slice(-2).map(e => e.song).filter((s): s is Song => !!s);
}

/** Query result with the editor's local override merged over it (server edits to rows win while a drag is held). */
export function effectiveLayout(server: Setlist | undefined, local: LocalLayout | null, dragging: boolean): LocalLayout | null {
  if (!local) return server ? { entries: server.entries, subsets: server.subsets ?? [] } : null;
  if (dragging && server) return { entries: local.entries.map(e => server.entries.find(i => i.order === e.order) ?? e), subsets: local.subsets };
  return local;
}

export const metaOf = (s: Setlist): SetlistMeta => ({ name: s.name, date: s.date ?? '', startTime: s.startTime ?? '', vibe: s.vibe ?? false });
const emptyMeta = (): SetlistMeta => ({ name: '', date: '', startTime: '', vibe: false });

const initialUi = (): EditorUi => ({
  showAddModal: false, showSetlistOnlyModal: false, showBreakPicker: false, editingComment: false, draftComment: '',
  editingBreakOrder: null, editingEntryId: null, lyricsViewEntryId: null,
  selectedMusician: null, filterNotReady: false, filterText: '', filterOpen: false,
  activeSubsetId: null, draftSubsetName: '',
  draggedEntryKey: null, overEntryKey: null, overEntrySide: 'before',
  draggedSubsetId: null, overSubsetId: null, overSubsetSide: 'before',
  dragEndedAt: 0, tier: 'wide',
});

const initialData = (): EditorData => ({
  setlistId: null, local: null,
  editingMeta: false, draftMeta: emptyMeta(), columnVisibility: {}, pollPaused: false,
});

export function createSetlistEditorStore() {
  let inflight = 0;
  let releaseTimer: ReturnType<typeof setTimeout> | null = null;
  const clearRelease = () => {
    if (releaseTimer !== null) { clearTimeout(releaseTimer); releaseTimer = null; }
  };

  return createStore<EditorState>((set, get) => {
    const isDragging = () => get().draggedEntryKey !== null || get().draggedSubsetId !== null;
    const view = (): LocalLayout => effectiveLayout(get().deps?.getServer(), get().local, isDragging()) ?? { entries: [], subsets: [] };
    const layout = () => buildSetlistLayout(view().entries, view().subsets);
    const holdRemaining = () => DRAG_GRACE_MS - (Date.now() - get().dragEndedAt);
    const holdLocal = () => { if (!get().local) set({ local: view() }); };
    /** Drop the local override once the drag grace has passed and nothing is being saved. */
    const scheduleRelease = () => {
      if (releaseTimer !== null) return;
      releaseTimer = setTimeout(() => {
        releaseTimer = null;
        if (isDragging() || inflight > 0 || holdRemaining() > 0) { scheduleRelease(); return; }
        set({ local: null });
      }, Math.max(50, holdRemaining()));
    };

    return {
      ...initialData(),
      ...initialUi(),
      deps: null,
      setDeps: deps => set({ deps }),
      patch: partial => set(partial),
      view,

      reset: setlistId => {
        clearRelease();
        inflight = 0;
        set({ ...initialData(), ...initialUi(), setlistId });
      },

      // ----- meta -----
      startEditMeta: () => {
        const server = get().deps?.getServer();
        if (server) set({ draftMeta: metaOf(server), editingMeta: true });
      },
      cancelEditMeta: () => set({ editingMeta: false }),
      setDraftMeta: partial => set(s => ({ draftMeta: { ...s.draftMeta, ...partial } })),
      saveMeta: async () => {
        const { deps, draftMeta } = get();
        const server = deps?.getServer();
        if (!deps || !server) return;
        const { entries, subsets } = view();
        await deps.updateSetlist({ ...server, ...draftMeta, entries, subsets });
        set({ editingMeta: false });
      },

      // ----- filters -----
      toggleMusician: name => set(s => ({ selectedMusician: s.selectedMusician === name ? null : name })),
      toggleFilterNotReady: () => set(s => ({ filterNotReady: !s.filterNotReady })),
      toggleFilterOpen: () => set(s => ({ filterOpen: !s.filterOpen })),

      // ----- layout / subsets -----
      persistLayout: async layoutItems => {
        const { deps } = get();
        const normalized = normalizeSetlistLayout(layoutItems);
        set({ local: { entries: normalized.entries, subsets: normalized.subsets } });
        if (!deps) return;
        inflight++;
        try {
          const saved = await deps.reorder(normalized.entries, normalized.subsets);
          set({ local: { entries: saved.entries, subsets: saved.subsets ?? [] } });
        } catch (err) {
          set({ local: null });
          throw err;
        } finally {
          inflight--;
        }
        scheduleRelease();
      },

      newSubset: async defaultName => {
        const subset: SetlistSubset = { id: crypto.randomUUID(), name: defaultName(view().subsets.length + 1) };
        const items = layout();
        const lastSubsetIndex = items.findLastIndex(item => item.kind === 'subset');
        items.splice(lastSubsetIndex + 1, 0, { kind: 'subset', subset, entries: [] });
        set({ activeSubsetId: subset.id, draftSubsetName: subset.name });
        await get().persistLayout(items);
      },

      openSubsetEdit: subset => set({ activeSubsetId: subset.id, draftSubsetName: subset.name }),

      finishSubsetEdit: async () => {
        const { activeSubsetId, draftSubsetName } = get();
        if (!activeSubsetId || !draftSubsetName.trim()) return;
        const items = layout().map(item =>
          item.kind === 'subset' && item.subset.id === activeSubsetId
            ? { ...item, subset: { ...item.subset, name: draftSubsetName.trim() } }
            : item
        );
        await get().persistLayout(items);
        set({ activeSubsetId: null });
      },

      dissolveSubset: async subsetId => {
        const items = layout();
        const index = items.findIndex(item => item.kind === 'subset' && item.subset.id === subsetId);
        if (index < 0) return;
        const [removed] = items.splice(index, 1);
        if (removed.kind === 'subset') {
          items.push(...removed.entries.map(entry => ({ kind: 'entry' as const, entry })));
        }
        if (get().activeSubsetId === subsetId) set({ activeSubsetId: null });
        await get().persistLayout(items);
      },

      moveSubset: (subsetId, targetSubsetId) => get().persistLayout(moveSubsetBlock(layout(), subsetId, targetSubsetId)),
      moveSubsetBy: (subsetId, delta) => get().persistLayout(moveSubsetBlockBy(layout(), subsetId, delta)),

      toggleSubsetMembership: async (entry, canWrite) => {
        const { activeSubsetId } = get();
        if (!canWrite || activeSubsetId === null || !entry.songId) return;
        if (entry.subsetId && entry.subsetId !== activeSubsetId) return; // belongs to another subset
        const subsetId = activeSubsetId;
        const subset = view().subsets.find(s => s.id === subsetId);
        if (!subset) return;

        const items = layout();
        const block = items.find((item): item is Extract<SetlistLayoutItem, { kind: 'subset' }> =>
          item.kind === 'subset' && item.subset.id === subsetId
        );
        if (!block) return;

        if (entry.subsetId === subsetId) {
          block.entries = block.entries.filter(member => member.songId !== entry.songId);
          items.push({ kind: 'entry', entry });
          await get().persistLayout(items);
          return;
        }

        const entryIndex = items.findIndex(item => item.kind === 'entry' && item.entry.songId === entry.songId);
        if (entryIndex < 0) return;
        items.splice(entryIndex, 1);
        const members = [...block.entries, { ...entry, subsetId }];
        let overrideList = members;
        if (!subset.manualSort) {
          const anchors = computeAnchors(view().entries, view().subsets, subsetId);
          const sortedSongs = sortSubset(members.map(e => e.song!), anchors);
          const bySongId = new Map(members.map(e => [e.songId!, e]));
          overrideList = sortedSongs.map(s => bySongId.get(s.id)!);
        }
        block.entries = overrideList;
        await get().persistLayout(items);
      },

      // ----- drag and drop -----
      startEntryDrag: key => { holdLocal(); set({ draggedEntryKey: key }); },
      setOverEntry: (key, side) => set(s => ({ overEntryKey: key, overEntrySide: side ?? s.overEntrySide })),
      startSubsetDrag: subsetId => { holdLocal(); set({ draggedSubsetId: subsetId }); },
      setOverSubset: (subsetId, side) => set(s => ({ overSubsetId: subsetId, overSubsetSide: side ?? s.overSubsetSide })),

      clearEntryDrag: () => {
        set(s => ({
          draggedEntryKey: null,
          overEntryKey: null,
          overSubsetId: s.draggedSubsetId ? s.overSubsetId : null,
          dragEndedAt: Date.now(),
        }));
        scheduleRelease();
      },
      clearSubsetDrag: () => {
        set({ draggedSubsetId: null, overSubsetId: null, dragEndedAt: Date.now() });
        scheduleRelease();
      },

      dropEntry: async () => {
        const { draggedEntryKey: sourceKey, overEntryKey: targetKey, overEntrySide } = get();
        if (!sourceKey || !targetKey || sourceKey === targetKey) {
          get().clearEntryDrag();
          return;
        }
        const next = moveLayoutEntry(layout(), sourceKey, targetKey, overEntrySide);
        get().clearEntryDrag();
        await get().persistLayout(next);
      },

      dropSubset: async () => {
        const source = get().draggedSubsetId;
        const target = get().overSubsetId;
        get().clearSubsetDrag();
        if (source && target && source !== target) await get().moveSubset(source, target);
      },

      dropEntryOnSubset: async subsetId => {
        const { draggedEntryKey, overSubsetSide } = get();
        if (!draggedEntryKey) return;
        const next = moveLayoutEntryToSubset(layout(), draggedEntryKey, subsetId, overSubsetSide);
        get().clearEntryDrag();
        set({ overSubsetId: null });
        await get().persistLayout(next);
      },

      dropAtCurrentTarget: async () => {
        const { draggedSubsetId, draggedEntryKey, overSubsetId } = get();
        if (draggedSubsetId) await get().dropSubset();
        else if (draggedEntryKey && overSubsetId) await get().dropEntryOnSubset(overSubsetId);
        else await get().dropEntry();
      },
    };
  });
}

/** The editor store instance used by the setlist editor components. */
export const setlistEditorStore = createSetlistEditorStore();
