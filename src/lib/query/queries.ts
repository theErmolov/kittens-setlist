/**
 * Read queries for every backend resource. Components call
 * `createQuery(() => songsQuery())` (or `createQuery(() => setlistQuery(id))`);
 * module code uses `queryClient.fetchQuery(...)`. Keys are the single source of
 * truth for invalidation — mutations in `$lib/query/*` use the same keys.
 */
import { infiniteQueryOptions, queryOptions } from '@tanstack/svelte-query';
import * as api from '$lib/api';
import { pollUnlessDenied } from './client';

export const keys = {
  musicians: ['musicians'] as const,
  songs: ['songs'] as const,
  song: (id: string) => ['songs', id] as const,
  setlists: ['setlists'] as const,
  setlist: (id: string) => ['setlists', id] as const,
  rehearsals: ['rehearsals'] as const,
  rehearsal: (id: string) => ['rehearsals', id] as const,
  users: ['users'] as const,
  audit: ['audit-log'] as const,
  budget: ['budget'] as const,
  receipt: (entryId: string) => ['budget', 'receipt', entryId] as const,
  onlinePresence: ['online-presence'] as const,
  notificationPreferences: ['notification-preferences'] as const,
};

export const musiciansQuery = () => queryOptions({ queryKey: keys.musicians, queryFn: api.getMusicians });
export const songsQuery = () => queryOptions({ queryKey: keys.songs, queryFn: api.getSongs });
export const songQuery = (id: string) => queryOptions({ queryKey: keys.song(id), queryFn: () => api.getSong(id) });
export const setlistsQuery = () => queryOptions({ queryKey: keys.setlists, queryFn: api.getSetlists });
export const setlistQuery = (id: string) => queryOptions({ queryKey: keys.setlist(id), queryFn: () => api.getSetlist(id) });
export const rehearsalsQuery = () => queryOptions({ queryKey: keys.rehearsals, queryFn: api.getRehearsals });
export const rehearsalQuery = (id: string) => queryOptions({ queryKey: keys.rehearsal(id), queryFn: () => api.getRehearsal(id) });
export const usersQuery = () => queryOptions({ queryKey: keys.users, queryFn: api.getUsers });
export const budgetQuery = () => queryOptions({ queryKey: keys.budget, queryFn: api.getBudget });
export const receiptUrlQuery = (entryId: string) => queryOptions({ queryKey: keys.receipt(entryId), queryFn: () => api.getReceiptUrl(entryId), staleTime: 60_000 });
export const notificationPreferencesQuery = () => queryOptions({ queryKey: keys.notificationPreferences, queryFn: api.getNotificationPreferences });
export const onlinePresenceQuery = () => queryOptions({ queryKey: keys.onlinePresence, queryFn: api.getOnlinePresence, refetchInterval: pollUnlessDenied(10_000) });

export const auditLogQuery = (limit: number) => infiniteQueryOptions({
  queryKey: [...keys.audit, limit] as const,
  queryFn: ({ pageParam }) => api.getAuditLog(limit, pageParam),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: last => last.nextCursor,
});
