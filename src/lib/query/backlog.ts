/**
 * Backlog (song catalog) queries and mutations. Songs poll like the old
 * `startPolling` did: skipped while the tab is hidden (refetchIntervalInBackground
 * false) or while presence says we're alone (`backlogPoll.isPaused`).
 */
import { createMutation, queryOptions, useQueryClient } from '@tanstack/svelte-query';
import * as api from '$lib/api';
import { queryClient } from './client';
import { keys } from './queries';
import { pollUnlessDenied } from './client';
import type { Song } from '$lib/types';

/** Set by the backlog page to the room's `PresenceController.isPaused`. */
export const backlogPoll = { isPaused: (): boolean => false };

export const backlogSongsQuery = (intervalMs: number) => queryOptions({
  queryKey: keys.songs,
  queryFn: async (): Promise<Song[]> => {
    const cached = queryClient.getQueryData<Song[]>(keys.songs);
    // Paused polls are no-ops; the first load always goes through.
    if (cached && backlogPoll.isPaused() && !document.hidden) return cached;
    return api.getSongs();
  },
  refetchInterval: pollUnlessDenied(intervalMs),
  refetchIntervalInBackground: false,
});

export function useAddBacklogSong() {
  const qc = useQueryClient();
  return createMutation<Song, Error, Song>(() => ({
    mutationFn: async (song) => {
      const { id: _, ...rest } = song;
      const created = await api.addSong(rest);
      if (song.personalComment) {
        await api.updatePersonalSongComment(created.id, song.personalComment);
        created.personalComment = song.personalComment;
      }
      return created;
    },
    onSuccess: created => qc.setQueryData<Song[]>(keys.songs, old => [...(old ?? []), created]),
  }));
}

export function useSaveBacklogSong() {
  const qc = useQueryClient();
  return createMutation<Song, Error, { song: Song; canWrite: boolean }>(() => ({
    mutationFn: async ({ song, canWrite }) => {
      const saved = canWrite ? await api.updateSong(song) : song;
      await api.updatePersonalSongComment(song.id, song.personalComment ?? '');
      return { ...saved, personalComment: song.personalComment ?? '' };
    },
    onSuccess: saved => qc.setQueryData<Song[]>(keys.songs, old => (old ?? []).map(s => s.id === saved.id ? saved : s)),
  }));
}

export function useDeleteBacklogSong() {
  const qc = useQueryClient();
  return createMutation<void, Error, string>(() => ({
    mutationFn: api.deleteSong,
    onSuccess: (_, id) => qc.setQueryData<Song[]>(keys.songs, old => (old ?? []).filter(s => s.id !== id)),
  }));
}

/** Writes a song edited elsewhere (lyrics overlay) into the cached list. */
/** Loads the song from the backend and writes it into the cached list, so the edit dialog never opens on a stale copy (readiness is changed from other pages too). Falls back to the cached copy on failure. */
export async function refreshBacklogSong(id: string): Promise<void> {
  const fresh = await api.getSong(id);
  if (fresh) patchBacklogSong(fresh);
}

export function patchBacklogSong(updated: Song): void {
  queryClient.setQueryData<Song[]>(keys.songs, old => (old ?? []).map(s => s.id === updated.id ? updated : s));
}
