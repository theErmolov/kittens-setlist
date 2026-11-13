/**
 * Stage-view queries/mutations: the polled setlist, optimistic "played"
 * marking, and lyrics-overlay transpose saves.
 */
import { createMutation, queryOptions, useQueryClient } from '@tanstack/svelte-query';
import * as api from '$lib/api';
import { queryClient } from './client';
import { keys } from './queries';
import { isEventFarFuture, isEventLongOver } from '$lib/utils';
import type { PresenceController } from '$lib/presence';
import type { Setlist, Song } from '$lib/types';
import { pollUnlessDenied } from './client';

// The stage view's presence controller; polls are skipped while it says we're alone.
let presence: PresenceController | null = null;
export function setStagePresence(p: PresenceController | null): void { presence = p; }

/**
 * Setlist query for the stage. `pollInterval` enables polling: hidden tabs are
 * skipped by TanStack (no background refetch), far-future events poll 10x slower,
 * and refetches are no-ops (cached value returned) when the event is long over or
 * presence says nobody else can change anything. Structural sharing keeps the
 * data reference stable when entries are identical.
 */
export function stageSetlistQuery(id: string, pollInterval?: number) {
  return queryOptions({
    queryKey: keys.setlist(id),
    queryFn: async (): Promise<Setlist> => {
      const cached = queryClient.getQueryData<Setlist>(keys.setlist(id));
      if (cached && pollInterval && (isEventLongOver(cached.date, cached.startTime) || presence?.isPaused())) return cached;
      const s = await api.getSetlist(id);
      if (!s) throw new Error('Setlist not found');
      return s;
    },
    refetchInterval: pollInterval
      ? pollUnlessDenied((query: { state: { data: Setlist | undefined } }) =>
          isEventFarFuture(query.state.data?.date, query.state.data?.startTime) ? pollInterval * 10 : pollInterval)
      : false,
    refetchIntervalInBackground: false,
  });
}

export type MarkTarget = { kind: 'song'; songId: string } | { kind: 'break'; order: number };
type MarkVars = MarkTarget & { setlistId: string; through: number | null };

function patchPlayed(sl: Setlist, v: MarkVars): Setlist {
  if (v.through !== null) {
    const through = v.through;
    return { ...sl, entries: sl.entries.map(e => e.order <= through && !e.played ? { ...e, played: true } : e) };
  }
  return {
    ...sl,
    entries: sl.entries.map(e => {
      const hit = v.kind === 'song' ? e.songId === v.songId : e.order === v.order && e.breakMinutes !== undefined;
      return hit ? { ...e, played: !e.played } : e;
    }),
  };
}

/** Optimistic played/unplayed toggling (marks everything before it for non-vibe setlists). */
export function useStageMark(getSetlistId: () => string) {
  const qc = useQueryClient();
  const m = createMutation<Setlist, Error, MarkVars, { previous?: Setlist }>(() => ({
    mutationFn: v => v.through !== null
      ? api.markThrough(v.setlistId, v.through)
      : v.kind === 'song' ? api.togglePlayed(v.setlistId, v.songId) : api.toggleBreakPlayed(v.setlistId, v.order),
    onMutate: async v => {
      await qc.cancelQueries({ queryKey: keys.setlist(v.setlistId) });
      const previous = qc.getQueryData<Setlist>(keys.setlist(v.setlistId));
      if (previous) qc.setQueryData(keys.setlist(v.setlistId), patchPlayed(previous, v));
      return { previous };
    },
    onError: (_e, v, ctx) => { if (ctx?.previous) qc.setQueryData(keys.setlist(v.setlistId), ctx.previous); },
    onSuccess: (setlist, v) => {
      qc.setQueryData(keys.setlist(v.setlistId), setlist);
      qc.invalidateQueries({ queryKey: keys.setlists, exact: true });
    },
  }));
  return {
    mark(target: MarkTarget) {
      const setlistId = getSetlistId();
      const sl = qc.getQueryData<Setlist>(keys.setlist(setlistId));
      if (!sl) return;
      const entry = target.kind === 'song'
        ? sl.entries.find(e => e.songId === target.songId)
        : sl.entries.find(e => e.order === target.order && e.breakMinutes !== undefined);
      if (!entry) return;
      const through = !sl.vibe && !entry.played ? entry.order : null;
      m.mutate({ ...target, setlistId, through });
    },
  };
}

/** Saves a transposed snapshot of a setlist-only song; resolves to the stored song. */
export function useSaveEntryTranspose(getSetlistId: () => string) {
  const qc = useQueryClient();
  const m = createMutation<Setlist, Error, { order: number; song: Song }>(() => ({
    mutationFn: v => api.updateEntrySong(getSetlistId(), v.order, v.song),
    onSuccess: setlist => qc.setQueryData(keys.setlist(getSetlistId()), setlist),
  }));
  return async (order: number, songId: string | undefined, song: Song): Promise<Song> => {
    const updated = await m.mutateAsync({ order, song });
    return updated.entries.find(c => c.songId === songId)?.song ?? song;
  };
}

/** Saves a song's transpose from the lyrics overlay (no audit entry). */
export function useSaveSongTranspose() {
  const qc = useQueryClient();
  return createMutation<Song, Error, Song>(() => ({
    mutationFn: song => api.updateSong(song, true),
    onSuccess: song => {
      qc.setQueryData(keys.song(song.id), song);
      qc.invalidateQueries({ queryKey: keys.songs, exact: true });
    },
  }));
}
