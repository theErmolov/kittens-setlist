/**
 * Queries and mutations for the app shell, admin area, budget and shared
 * components. Components call these hooks during init (they need the
 * QueryClient context); module code uses `queryClient.fetchQuery(...)`.
 */
import { createMutation, queryOptions, useQueryClient } from '@tanstack/svelte-query';
import * as api from '$lib/api';
import { keys } from './queries';
import type { BudgetEntry } from '$lib/types';

// ─── Presence heartbeat ───────────────────────────────────────────────────────

/** Always-fresh heartbeat; use with `queryClient.fetchQuery`. The result (the other live viewers) stays in the query cache and is read from there. */
export const presenceHeartbeatQuery = (room: string, clientId: string) => queryOptions({
  queryKey: ['presence-heartbeat', room, clientId] as const,
  queryFn: () => api.heartbeatPresence(room, clientId),
  staleTime: 0,
  gcTime: 60_000,
  retry: false,
  meta: { ignoreForbidden: true },
});

// ─── Audit log (one page at a time, cursor-addressed) ──────────────────────────

export const auditPageQuery = (limit: number, cursor: string | undefined, enabled: boolean) => queryOptions({
  queryKey: [...keys.audit, 'page', limit, cursor ?? null] as const,
  queryFn: () => api.getAuditLog(limit, cursor),
  enabled,
  staleTime: 0,
});

// ─── Users / musicians (admin) ─────────────────────────────────────────────────

export function useAdminUserMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: keys.users });
  const patchUser = createMutation(() => ({
    mutationFn: ({ id, patch }: { id: string; patch: api.UserPatch }) => api.patchUser(id, patch),
    onSuccess: refresh,
  }));
  const addMusician = createMutation(() => ({
    mutationFn: (m: Parameters<typeof api.addMusician>[0]) => api.addMusician(m),
    onSuccess: refresh,
  }));
  const updateMusician = createMutation(() => ({
    mutationFn: (m: Parameters<typeof api.updateMusician>[0]) => api.updateMusician(m),
  }));
  const deleteMusician = createMutation(() => ({
    mutationFn: (id: string) => api.deleteMusician(id),
    onSuccess: refresh,
  }));
  return { patchUser, addMusician, updateMusician, deleteMusician, refresh };
}

// ─── Budget ───────────────────────────────────────────────────────────────────

export function useBudgetMutations() {
  const qc = useQueryClient();
  const upsert = (saved: BudgetEntry) => qc.setQueryData<BudgetEntry[]>(keys.budget, old => {
    const list = old ?? [];
    return list.some(e => e.id === saved.id) ? list.map(e => e.id === saved.id ? saved : e) : [...list, saved];
  });
  const add = createMutation(() => ({
    mutationFn: (e: Parameters<typeof api.addBudgetEntry>[0]) => api.addBudgetEntry(e),
    onSuccess: upsert,
  }));
  const update = createMutation(() => ({
    mutationFn: (e: BudgetEntry) => api.updateBudgetEntry(e),
    onSuccess: upsert,
  }));
  const remove = createMutation(() => ({
    mutationFn: (id: string) => api.deleteBudgetEntry(id),
    onSuccess: (_: void, id: string) => qc.setQueryData<BudgetEntry[]>(keys.budget, old => (old ?? []).filter(e => e.id !== id)),
  }));
  const uploadReceipt = createMutation(() => ({
    mutationFn: ({ entryId, file }: { entryId: string; file: File }) => api.uploadReceipt(entryId, file),
  }));
  /** Opens a receipt in a new tab (fresh presigned URL each time). */
  const openReceipt = createMutation(() => ({
    mutationFn: (entryId: string) => qc.fetchQuery({ queryKey: keys.receipt(entryId), queryFn: () => api.getReceiptUrl(entryId), staleTime: 0 }),
    onSuccess: (url: string) => { window.open(url, '_blank'); },
  }));
  return { add, update, remove, uploadReceipt, openReceipt };
}

// ─── Notification preferences ──────────────────────────────────────────────────

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return createMutation(() => ({
    mutationFn: (enabled: boolean) => api.updateNotificationPreferences(enabled),
    onSuccess: value => qc.setQueryData(keys.notificationPreferences, value),
  }));
}
