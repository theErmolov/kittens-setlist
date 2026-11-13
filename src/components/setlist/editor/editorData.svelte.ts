/**
 * Shared read-side of the setlist editor. Components call `useEditorData()` during
 * init and read reactive getters: backend data comes from TanStack Query
 * (musicians, songs), the working copy and filters from the Zustand store.
 */
import { createQuery } from '@tanstack/svelte-query';
import { fromStore } from 'svelte/store';
import { musiciansQuery, songsQuery } from '$lib/query/queries';
import { editorSetlistQuery } from '$lib/query/setlistEditor';
import { useStore } from '$lib/store/bridge';
import { setlistEditorStore, sortEntries, filterEntries, isFilterActive, effectiveLayout, metaOf, type EditorState, type SetlistMeta } from '$lib/store/setlistEditor';
import { songReadiness, entryMinutes } from '$lib/utils';
import { countByMusician, guestMusicianNames } from '$lib/musicianStats';
import type { SetlistEntry } from '$lib/types';

export function useEditorData() {
  const sel = <T,>(selector: (s: EditorState) => T) => fromStore(useStore(setlistEditorStore, selector));
  const setlistIdS = sel(s => s.setlistId);
  const localS = sel(s => s.local);
  const draggingS = sel(s => s.draggedEntryKey !== null || s.draggedSubsetId !== null);
  const selectedMusicianS = sel(s => s.selectedMusician);
  const filterNotReadyS = sel(s => s.filterNotReady);
  const filterTextS = sel(s => s.filterText);

  // The setlist comes from the query; the store's local override is merged over it at read time.
  const setlistQ = createQuery(() => ({ ...editorSetlistQuery(setlistIdS.current ?? ''), enabled: !!setlistIdS.current }));
  const layout = $derived(effectiveLayout(setlistQ.data, localS.current, draggingS.current));
  const entries = $derived(layout?.entries ?? []);
  const subsets = $derived(layout?.subsets ?? []);
  const meta = $derived<SetlistMeta>(setlistQ.data ? metaOf(setlistQ.data) : { name: '', date: '', startTime: '', vibe: false, comment: '' });

  const musiciansQ = createQuery(() => musiciansQuery());
  const songsQ = createQuery(() => songsQuery());

  const musicians = $derived(musiciansQ.data ?? []);
  const allMusicians = $derived(musicians.map(m => m.name));
  const permanentNames = $derived(new Set(allMusicians));
  const sortedEntries = $derived(sortEntries(entries));
  const columnMusicians = $derived(allMusicians.filter(name =>
    entries.some(entry => (entry.song?.musicians[name]?.instruments?.length ?? 0) > 0)
  ));
  const guestNames = $derived(guestMusicianNames(sortedEntries.map(e => e.song), permanentNames));
  const filter = $derived({ selectedMusician: selectedMusicianS.current, filterNotReady: filterNotReadyS.current, filterText: filterTextS.current });
  const isFiltered = $derived(isFilterActive(filter));
  const displayEntries = $derived(filterEntries(sortedEntries, filter));
  const songCount = $derived(sortedEntries.filter(e => e.songId).length);
  const totalMinutes = $derived(sortedEntries.reduce((s, e) => s + entryMinutes(e), 0));
  const readyCount = $derived(
    sortedEntries.filter(e => e.song && songReadiness(e.song.musicians, e.progress ?? {}, new Set()) === 'ready').length
  );
  const musicianCounts = $derived(countByMusician(sortedEntries.map(e => e.song), [...allMusicians, ...guestNames]));
  const existingIds = $derived(new Set(entries.map(e => e.songId).filter((id): id is string => !!id)));

  return {
    get musicians() { return musicians; },
    get songs() { return songsQ.data ?? []; },
    /** True once musicians and songs have settled (success or error). */
    get ready() { return !musiciansQ.isPending && !songsQ.isPending; },
    get allMusicians() { return allMusicians; },
    get columnMusicians() { return columnMusicians; },
    get guestNames() { return guestNames; },
    get permanentNames() { return permanentNames; },
    get entries(): SetlistEntry[] { return entries; },
    get loaded() { return !!setlistQ.data; },
    get comment() { return setlistQ.data?.comment ?? ''; },
    get meta() { return meta; },
    get sortedEntries() { return sortedEntries; },
    get displayEntries() { return displayEntries; },
    get isFiltered() { return isFiltered; },
    get songCount() { return songCount; },
    get totalMinutes() { return totalMinutes; },
    get readyCount() { return readyCount; },
    get musicianCounts() { return musicianCounts; },
    get existingIds() { return existingIds; },
    get subsets() { return subsets; },
  };
}
