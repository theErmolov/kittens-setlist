/**
 * Extra queries/mutations used only by the setlist editor. Setlist writes that
 * return the updated setlist live in `setlistMutations.ts`.
 */
import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import * as api from '$lib/api';
import { keys, setlistQuery } from './queries';
import type { Song } from '$lib/types';

/** The editor's setlist query: always refetched on focus/poll (the store's smart merge skips no-ops). */
export const editorSetlistQuery = (id: string) => ({ ...setlistQuery(id), staleTime: 0 });

/** PATCH the author's private note on an entry (returns nothing). */
export function useUpdatePersonalEntryComment() {
  return createMutation<void, Error, { setlistId: string; songId: string; comment: string }>(() => ({
    mutationFn: v => api.updatePersonalEntryComment(v.setlistId, v.songId, v.comment),
  }));
}

/**
 * Sync progress / length / lyrics edited on a setlist entry back to the
 * canonical backlog song. Fetches the fresh song first so keys missing from the
 * entry snapshot are not wiped.
 */
export function useSyncEntryToCatalog() {
  const qc = useQueryClient();
  return createMutation<void, Error, { songId: string; edited: Song }>(() => ({
    mutationFn: async ({ songId, edited }) => {
      const canonical = await qc.fetchQuery({ queryKey: keys.song(songId), queryFn: () => api.getSong(songId), staleTime: 0 });
      if (!canonical) return;
      await api.updateSong({
        ...canonical,
        progress: { ...(canonical.progress ?? {}), ...(edited.progress ?? {}) },
        lengthMinutes: edited.lengthMinutes ?? canonical.lengthMinutes,
        lyrics: edited.lyrics ?? canonical.lyrics,
      }, true);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.songs }); },
  }));
}
