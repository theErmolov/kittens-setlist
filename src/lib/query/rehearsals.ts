/**
 * Rehearsal write operations. Callers decide how the saved rehearsal lands in the
 * detail cache (the detail page writes optimistically and must not let a late
 * acknowledgement replace a newer local order), so the update/delete hooks only
 * invalidate the list. Call these hooks during component init.
 */
import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import * as api from '$lib/api';
import { keys } from './queries';
import type { Rehearsal, RehearsalDraft, RehearsalSong, Song, LearningStage } from '$lib/types';

export function useCreateRehearsal() {
  const qc = useQueryClient();
  return createMutation<Rehearsal, Error, { draft: RehearsalDraft; copyFromId?: string }>(() => ({
    mutationFn: ({ draft, copyFromId }) => api.createRehearsal(draft, copyFromId),
    onSuccess: created => {
      qc.setQueryData(keys.rehearsal(created.id), created);
      qc.invalidateQueries({ queryKey: keys.rehearsals, exact: true });
    },
  }));
}

export function useUpdateRehearsal() {
  const qc = useQueryClient();
  return createMutation<Rehearsal, Error, Rehearsal>(() => ({
    mutationFn: api.updateRehearsal,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.rehearsals, exact: true }),
  }));
}

export function useDeleteRehearsal() {
  const qc = useQueryClient();
  return createMutation<void, Error, Rehearsal>(() => ({
    mutationFn: api.deleteRehearsal,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.rehearsals, exact: true }),
  }));
}

export function useUpdateRehearsalProgress() {
  const qc = useQueryClient();
  return createMutation<Rehearsal, Error, { id: string; song: Pick<RehearsalSong, 'songId' | 'sourceSetlistId'>; musicianName: string; stage: LearningStage }>(() => ({
    mutationFn: v => api.updateRehearsalProgress(v.id, v.song, v.musicianName, v.stage),
    onSuccess: (rehearsal, v) => {
      qc.setQueryData(keys.rehearsal(v.id), rehearsal);
      // Picker readiness should also reflect this latest canonical progress.
      qc.setQueryData<Song[]>(keys.songs, songs => songs?.map(song => song.id === v.song.songId ? { ...song, progress: { ...(song.progress ?? {}), [v.musicianName]: v.stage } } : song));
      qc.invalidateQueries({ queryKey: keys.rehearsals, exact: true });
    },
  }));
}
