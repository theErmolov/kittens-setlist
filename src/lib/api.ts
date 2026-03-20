/**
 * API layer — all calls go to the AWS backend via PUBLIC_API_URL.
 * To swap the backend, only this file needs to change.
 */
import { PUBLIC_API_URL } from '$env/static/public';
import type { Song, Setlist, SetlistEntry, BandMusician } from '$lib/types';

const BASE = PUBLIC_API_URL;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Musicians ────────────────────────────────────────────────────────────────

export async function getMusicians(): Promise<BandMusician[]> {
  const items = await req<BandMusician[]>('/musicians');
  return items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export async function addMusician(m: Omit<BandMusician, 'id'>): Promise<BandMusician> {
  return req('/musicians', { method: 'POST', body: JSON.stringify(m) });
}

export async function updateMusician(m: BandMusician): Promise<BandMusician> {
  return req(`/musicians/${m.id}`, { method: 'PUT', body: JSON.stringify(m) });
}

export async function deleteMusician(id: string): Promise<void> {
  await req(`/musicians/${id}`, { method: 'DELETE' });
}

// ─── Songs ────────────────────────────────────────────────────────────────────

export async function getSongs(): Promise<Song[]> {
  return req('/songs');
}

export async function addSong(song: Omit<Song, 'id'>): Promise<Song> {
  return req('/songs', { method: 'POST', body: JSON.stringify(song) });
}

export async function updateSong(song: Song): Promise<Song> {
  return req(`/songs/${song.id}`, { method: 'PUT', body: JSON.stringify(song) });
}

export async function deleteSong(id: string): Promise<void> {
  await req(`/songs/${id}`, { method: 'DELETE' });
}

// ─── Setlists ─────────────────────────────────────────────────────────────────

export async function getSetlists(): Promise<Setlist[]> {
  return req('/setlists');
}

export async function getSetlist(id: string): Promise<Setlist | undefined> {
  return req(`/setlists/${id}`);
}

export async function createSetlist(name: string, date?: string): Promise<Setlist> {
  return req('/setlists', { method: 'POST', body: JSON.stringify({ name, date }) });
}

export async function updateSetlist(setlist: Setlist): Promise<Setlist> {
  return req(`/setlists/${setlist.id}`, { method: 'PUT', body: JSON.stringify(setlist) });
}

export async function deleteSetlist(id: string): Promise<void> {
  await req(`/setlists/${id}`, { method: 'DELETE' });
}

export async function addBreakToSetlist(setlistId: string, minutes: number): Promise<Setlist> {
  return req(`/setlists/${setlistId}/breaks`, { method: 'POST', body: JSON.stringify({ minutes }) });
}

export async function removeBreakFromSetlist(setlistId: string, order: number): Promise<Setlist> {
  return req(`/setlists/${setlistId}/breaks/${order}`, { method: 'DELETE' });
}

export async function addSongsToSetlist(setlistId: string, songIds: string[]): Promise<Setlist> {
  return req(`/setlists/${setlistId}/songs`, { method: 'POST', body: JSON.stringify({ songIds }) });
}

export async function removeSongFromSetlist(setlistId: string, songId: string): Promise<Setlist> {
  return req(`/setlists/${setlistId}/songs/${songId}`, { method: 'DELETE' });
}

export async function togglePlayed(setlistId: string, songId: string): Promise<Setlist> {
  return req(`/setlists/${setlistId}/played`, { method: 'POST', body: JSON.stringify({ songId }) });
}

export async function updateEntryComment(setlistId: string, order: number, comment: string): Promise<Setlist> {
  return req(`/setlists/${setlistId}/entry-comment`, { method: 'PATCH', body: JSON.stringify({ order, comment }) });
}

export async function reorderEntries(setlistId: string, entries: SetlistEntry[]): Promise<Setlist> {
  return req(`/setlists/${setlistId}/order`, { method: 'PUT', body: JSON.stringify({ entries }) });
}
