/**
 * API layer — all calls go to the AWS backend via PUBLIC_API_URL.
 * To swap the backend, only this file needs to change.
 */
import { PUBLIC_API_URL } from '$env/static/public';
import type { Song, Setlist, SetlistEntry, SetlistSubset, BandMusician, User, UserRole, UserStatus, Instrument, LearningStage, AuditLogEntry, BudgetEntry, PresenceEntry } from '$lib/types';
import { getToken } from '$lib/auth';

const BASE = PUBLIC_API_URL;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
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

export async function updateSong(song: Song, noaudit = false): Promise<Song> {
  const path = noaudit ? `/songs/${song.id}?noaudit=1` : `/songs/${song.id}`;
  return req(path, { method: 'PUT', body: JSON.stringify(song) });
}

export async function getSong(id: string): Promise<Song | null> {
  try { return await req<Song>(`/songs/${id}`); } catch { return null; }
}

export async function deleteSong(id: string): Promise<void> {
  await req(`/songs/${id}`, { method: 'DELETE' });
}

export async function updateSongProgress(songId: string, musicianName: string, stage: LearningStage): Promise<Song> {
  return req(`/songs/${songId}/progress`, { method: 'PATCH', body: JSON.stringify({ musicianName, stage }) });
}

export async function updateEntryProgress(
  setlistId: string, order: number, musicianName: string,
  stage: LearningStage, songId: string, isPermanent: boolean
): Promise<Setlist> {
  return req(`/setlists/${setlistId}/entry-progress`, {
    method: 'PATCH',
    body: JSON.stringify({ order, musicianName, stage, songId, isPermanent }),
  });
}

// ─── Setlists ─────────────────────────────────────────────────────────────────

export async function getSetlists(): Promise<Setlist[]> {
  return req('/setlists');
}

export async function getSetlist(id: string): Promise<Setlist | undefined> {
  return req(`/setlists/${id}`);
}

export async function createSetlist(name: string, date?: string, startTime?: string, vibe?: boolean): Promise<Setlist> {
  return req('/setlists', { method: 'POST', body: JSON.stringify({ name, date, startTime, vibe }) });
}

export async function markThrough(setlistId: string, targetOrder: number): Promise<Setlist> {
  return req(`/setlists/${setlistId}/mark-through`, { method: 'POST', body: JSON.stringify({ targetOrder }) });
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

export async function updateBreak(setlistId: string, order: number, minutes: number): Promise<Setlist> {
  return req(`/setlists/${setlistId}/breaks/${order}`, { method: 'PATCH', body: JSON.stringify({ minutes }) });
}

export async function addSongsToSetlist(setlistId: string, songs: Song[]): Promise<Setlist> {
  return req(`/setlists/${setlistId}/songs`, { method: 'POST', body: JSON.stringify({ songs }) });
}

export async function addSetlistOnlySong(setlistId: string, song: Song): Promise<Setlist> {
  return req(`/setlists/${setlistId}/songs`, {
    method: 'POST',
    body: JSON.stringify({ songs: [song], setlistOnly: true }),
  });
}

export async function updateEntrySong(setlistId: string, order: number, song: Song): Promise<Setlist> {
  return req(`/setlists/${setlistId}/entry-song`, { method: 'PATCH', body: JSON.stringify({ order, song }) });
}

export async function removeSongFromSetlist(setlistId: string, songId: string): Promise<Setlist> {
  return req(`/setlists/${setlistId}/songs/${songId}`, { method: 'DELETE' });
}

export async function togglePlayed(setlistId: string, songId: string): Promise<Setlist> {
  return req(`/setlists/${setlistId}/played`, { method: 'POST', body: JSON.stringify({ songId }) });
}

export async function toggleBreakPlayed(setlistId: string, breakOrder: number): Promise<Setlist> {
  return req(`/setlists/${setlistId}/played`, { method: 'POST', body: JSON.stringify({ breakOrder }) });
}

export async function updateEntryComment(setlistId: string, order: number, comment: string): Promise<Setlist> {
  return req(`/setlists/${setlistId}/entry-comment`, { method: 'PATCH', body: JSON.stringify({ order, comment }) });
}

export async function reorderEntries(setlistId: string, entries: SetlistEntry[], subsets?: SetlistSubset[]): Promise<Setlist> {
  return req(`/setlists/${setlistId}/order`, { method: 'PUT', body: JSON.stringify(subsets !== undefined ? { entries, subsets } : { entries }) });
}

// ─── Auth (admin) ──────────────────────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
  return req('/auth/users');
}

export interface UserPatch {
  status?: UserStatus;
  role?: UserRole | null;
  musicianName?: string | null;
  defaultInstruments?: Instrument[];
  sortOrder?: number;
  guest?: boolean;
  mergeIntoUserId?: string;
}

export async function patchUser(id: string, patch: UserPatch): Promise<User> {
  return req(`/auth/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function getAuditLog(limit: number, cursor?: string): Promise<{ items: AuditLogEntry[]; nextCursor?: string }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return req(`/auth/audit-log?${params}`);
}

// ─── Budget (admin only) ────────────────────────────────────────────────────────

export async function getBudget(): Promise<BudgetEntry[]> {
  return req('/budget');
}

export async function addBudgetEntry(entry: Omit<BudgetEntry, 'id' | 'createdAt' | 'createdBy'>): Promise<BudgetEntry> {
  return req('/budget', { method: 'POST', body: JSON.stringify(entry) });
}

export async function updateBudgetEntry(entry: BudgetEntry): Promise<BudgetEntry> {
  return req(`/budget/${entry.id}`, { method: 'PUT', body: JSON.stringify(entry) });
}

export async function deleteBudgetEntry(id: string): Promise<void> {
  await req(`/budget/${id}`, { method: 'DELETE' });
}

/** Upload a receipt file to S3 via a presigned URL; returns the stored object key. */
export async function uploadReceipt(entryId: string, file: File): Promise<string> {
  const { url, key } = await req<{ url: string; key: string }>(
    `/budget/${entryId}/receipt-url`,
    { method: 'POST', body: JSON.stringify({ contentType: file.type || 'application/octet-stream' }) },
  );
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
  if (!res.ok) throw new Error(`Receipt upload failed → ${res.status}`);
  return key;
}

/** Get a short-lived presigned URL to view a stored receipt. */
export async function getReceiptUrl(entryId: string): Promise<string> {
  const { url } = await req<{ url: string }>(`/budget/${entryId}/receipt-url`);
  return url;
}

// ─── Presence ─────────────────────────────────────────────────────────────────

/** Heartbeat: upsert our presence on a setlist; returns the other live viewers. */
export async function heartbeatPresence(setlistId: string, clientId: string): Promise<{ others: PresenceEntry[] }> {
  return req(`/setlists/${setlistId}/presence`, { method: 'POST', body: JSON.stringify({ clientId }) });
}

/** Best-effort leave: removes our presence. keepalive so it survives tab close. */
export function leavePresence(setlistId: string, clientId: string): void {
  const token = getToken();
  fetch(`${BASE}/setlists/${setlistId}/presence?clientId=${encodeURIComponent(clientId)}`, {
    method: 'DELETE',
    keepalive: true,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }).catch(() => {});
}
