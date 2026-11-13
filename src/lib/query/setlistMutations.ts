/**
 * Setlist write operations. Every setlist endpoint returns the updated
 * `Setlist`, which is written straight into the cache; the list is invalidated.
 * Call these hooks during component init (they use the QueryClient context).
 */
import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import * as api from '$lib/api';
import { keys } from './queries';
import type { Setlist, Song, SetlistEntry, SetlistSubset, LearningStage } from '$lib/types';

function setlistMutation<V>(fn: (setlistId: string, v: V) => Promise<Setlist>) {
  const qc = useQueryClient();
  return createMutation<Setlist, Error, V & { setlistId: string }>(() => ({
    mutationFn: ({ setlistId, ...v }) => fn(setlistId, v as V),
    onSuccess: (setlist, { setlistId }) => {
      qc.setQueryData(keys.setlist(setlistId), setlist);
      qc.invalidateQueries({ queryKey: keys.setlists, exact: true });
    },
  }));
}

export const useAddSongs = () => setlistMutation<{ songs: Song[] }>((id, v) => api.addSongsToSetlist(id, v.songs));
export const useAddSetlistOnlySong = () => setlistMutation<{ song: Song }>((id, v) => api.addSetlistOnlySong(id, v.song));
export const useRemoveSong = () => setlistMutation<{ songId: string }>((id, v) => api.removeSongFromSetlist(id, v.songId));
export const useAddBreak = () => setlistMutation<{ minutes: number }>((id, v) => api.addBreakToSetlist(id, v.minutes));
export const useRemoveBreak = () => setlistMutation<{ order: number }>((id, v) => api.removeBreakFromSetlist(id, v.order));
export const useUpdateBreak = () => setlistMutation<{ order: number; minutes: number }>((id, v) => api.updateBreak(id, v.order, v.minutes));
export const useUpdateEntrySong = () => setlistMutation<{ order: number; song: Song }>((id, v) => api.updateEntrySong(id, v.order, v.song));
export const useUpdateEntryComment = () => setlistMutation<{ order: number; comment: string }>((id, v) => api.updateEntryComment(id, v.order, v.comment));
export const useReorderEntries = () => setlistMutation<{ entries: SetlistEntry[]; subsets?: SetlistSubset[] }>((id, v) => api.reorderEntries(id, v.entries, v.subsets));

/** Replaces the whole setlist (name/date/vibe/etc.). */
export function useUpdateSetlist() {
  const qc = useQueryClient();
  return createMutation<Setlist, Error, Setlist>(() => ({
    mutationFn: api.updateSetlist,
    onSuccess: (setlist) => {
      qc.setQueryData(keys.setlist(setlist.id), setlist);
      qc.invalidateQueries({ queryKey: keys.setlists, exact: true });
    },
  }));
}

export function useCreateSetlist() {
  const qc = useQueryClient();
  return createMutation<Setlist, Error, { name: string; date?: string; startTime?: string; vibe?: boolean }>(() => ({
    mutationFn: v => api.createSetlist(v.name, v.date, v.startTime, v.vibe),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.setlists }),
  }));
}

export function useDeleteSetlist() {
  const qc = useQueryClient();
  return createMutation<void, Error, string>(() => ({
    mutationFn: api.deleteSetlist,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.setlists }),
  }));
}
