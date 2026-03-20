/**
 * API layer — mock/localStorage now, real HTTP later.
 * All functions are async to match the future backend contract.
 */
import { get } from 'svelte/store';
import { songsStore } from '$lib/stores/songs';
import { setlistsStore } from '$lib/stores/setlists';
import { musiciansStore } from '$lib/stores/musicians';
import type { Song, Setlist, SetlistEntry, BandMusician } from '$lib/types';

// ─── Musicians ────────────────────────────────────────────────────────────────

export async function getMusicians(): Promise<BandMusician[]> {
  return get(musiciansStore);
}

export async function addMusician(m: Omit<BandMusician, 'id'>): Promise<BandMusician> {
  const musician = { ...m, id: crypto.randomUUID() };
  musiciansStore.add(musician);
  return musician;
}

export async function updateMusician(m: BandMusician): Promise<BandMusician> {
  musiciansStore.update(m);
  return m;
}

export async function deleteMusician(id: string): Promise<void> {
  const musician = get(musiciansStore).find(m => m.id === id);
  if (musician) {
    // Remove this musician from every song
    const songs = get(songsStore);
    for (const song of songs) {
      if (musician.name in song.musicians) {
        const { [musician.name]: _, ...rest } = song.musicians;
        songsStore.updateSong({ ...song, musicians: rest });
      }
    }
  }
  musiciansStore.remove(id);
}

// ─── Songs ───────────────────────────────────────────────────────────────────

export async function getSongs(): Promise<Song[]> {
  return get(songsStore);
}

export async function addSong(song: Omit<Song, 'id'>): Promise<Song> {
  const newSong: Song = { ...song, id: crypto.randomUUID() };
  songsStore.addSong(newSong);
  return newSong;
}

export async function updateSong(song: Song): Promise<Song> {
  songsStore.updateSong(song);
  return song;
}

export async function deleteSong(id: string): Promise<void> {
  songsStore.deleteSong(id);
}

// ─── Setlists ─────────────────────────────────────────────────────────────────

export async function getSetlists(): Promise<Setlist[]> {
  return get(setlistsStore);
}

export async function getSetlist(id: string): Promise<Setlist | undefined> {
  return get(setlistsStore).find(l => l.id === id);
}

export async function createSetlist(name: string, date?: string): Promise<Setlist> {
  const setlist: Setlist = { id: crypto.randomUUID(), name, date, entries: [] };
  setlistsStore.addSetlist(setlist);
  return setlist;
}

export async function updateSetlist(setlist: Setlist): Promise<Setlist> {
  setlistsStore.updateSetlist(setlist);
  return setlist;
}

export async function deleteSetlist(id: string): Promise<void> {
  setlistsStore.deleteSetlist(id);
}

export async function addBreakToSetlist(setlistId: string, minutes: number): Promise<void> {
  const setlist = get(setlistsStore).find(l => l.id === setlistId);
  if (!setlist) return;
  const maxOrder = setlist.entries.reduce((m, e) => Math.max(m, e.order), -1);
  setlistsStore.updateSetlist({ ...setlist, entries: [...setlist.entries, { breakMinutes: minutes, order: maxOrder + 1, played: false }] });
}

export async function removeBreakFromSetlist(setlistId: string, order: number): Promise<void> {
  const setlist = get(setlistsStore).find(l => l.id === setlistId);
  if (!setlist) return;
  setlistsStore.updateSetlist({ ...setlist, entries: setlist.entries.filter(e => e.order !== order) });
}

export async function addSongsToSetlist(setlistId: string, songIds: string[]): Promise<void> {
  const setlist = get(setlistsStore).find(l => l.id === setlistId);
  if (!setlist) return;
  const existing = new Set(setlist.entries.map(e => e.songId).filter(Boolean));
  const maxOrder = setlist.entries.reduce((m, e) => Math.max(m, e.order), -1);
  const newEntries: SetlistEntry[] = songIds
    .filter(id => !existing.has(id))
    .map((id, i) => ({ songId: id, order: maxOrder + 1 + i, played: false }));
  setlistsStore.updateSetlist({ ...setlist, entries: [...setlist.entries, ...newEntries] });
}

export async function removeSongFromSetlist(setlistId: string, songId: string): Promise<void> {
  const setlist = get(setlistsStore).find(l => l.id === setlistId);
  if (!setlist) return;
  const entries = setlist.entries.filter(e => e.songId !== songId);
  setlistsStore.updateSetlist({ ...setlist, entries });
}

export async function togglePlayed(setlistId: string, songId: string): Promise<void> {
  setlistsStore.togglePlayed(setlistId, songId);
}

export async function reorderEntries(setlistId: string, entries: SetlistEntry[]): Promise<void> {
  setlistsStore.reorderEntries(setlistId, entries);
}
