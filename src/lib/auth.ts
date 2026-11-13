import { browser } from '$app/environment';
import { derived, get } from 'svelte/store';
import { queryOptions } from '@tanstack/svelte-query';
import type { User } from '$lib/types';
import { PUBLIC_API_URL } from '$env/static/public';
import { queryClient } from '$lib/query/client';
import { queryStore } from '$lib/store/bridge';

const TOKEN_KEY = 'auth_token';
/** Placeholder stored when logged out, so the key is visible and editable in DevTools. */
const NO_TOKEN = 'invalid';

/** `/auth/me` through TanStack Query: the user, or `null` when logged out. A network error rejects, so the guard never redirects to login while offline. */
export const meQueryOptions = queryOptions({
  queryKey: ['auth', 'me'] as const,
  queryFn: async (): Promise<User | null> => {
    const token = getToken();
    if (!token) return null;
    const res = await fetch(`${PUBLIC_API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) return await res.json() as User;
    if (res.status === 401) { clearToken(); return null; }
    throw new Error(`GET /auth/me → ${res.status}`);
  },
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  retry: 2,
});

const me = queryStore<User | null>(queryClient, meQueryOptions);
export const currentUser = derived(me, $me => $me.data ?? null);
/** True until the first `/auth/me` result (or while it keeps failing on the network). */
export const authLoading = derived(me, $me => $me.data === undefined);

export function getToken(): string | null {
  if (!browser) return null;
  const token = localStorage.getItem(TOKEN_KEY);
  return token && token !== NO_TOKEN ? token : null;
}

export function setToken(token: string): void {
  if (!browser) return;
  localStorage.setItem(TOKEN_KEY, token);
}

/** Logs out by storing the `invalid` placeholder (never sent as a token) instead of removing the key. */
export function clearToken(): void {
  if (!browser) return;
  localStorage.setItem(TOKEN_KEY, NO_TOKEN);
}

if (browser && !localStorage.getItem(TOKEN_KEY)) clearToken();

// Cached auth-derived nav flags. The nav bar reads these on first paint so the
// icon count is stable before initAuth() resolves (avoids the reflow jump on
// mobile where links are flex:1 and the admin/logout chrome appears late).
const NAV_ADMIN_KEY = 'kittens_nav_admin';
const NAV_LOGGED_IN_KEY = 'kittens_nav_logged_in';
const NAV_REHEARSALS_KEY = 'kittens_nav_rehearsals';

export function getCachedNavFlags(): { isAdmin: boolean; loggedIn: boolean; canAccessRehearsals: boolean } {
  if (!browser) return { isAdmin: false, loggedIn: false, canAccessRehearsals: false };
  return {
    isAdmin: localStorage.getItem(NAV_ADMIN_KEY) === '1',
    loggedIn: localStorage.getItem(NAV_LOGGED_IN_KEY) === '1',
    canAccessRehearsals: localStorage.getItem(NAV_REHEARSALS_KEY) === '1' || localStorage.getItem(NAV_ADMIN_KEY) === '1',
  };
}

export function setCachedNavFlags({ isAdmin, loggedIn, canAccessRehearsals }: { isAdmin: boolean; loggedIn: boolean; canAccessRehearsals: boolean }): void {
  if (!browser) return;
  localStorage.setItem(NAV_ADMIN_KEY, isAdmin ? '1' : '0');
  localStorage.setItem(NAV_LOGGED_IN_KEY, loggedIn ? '1' : '0');
  localStorage.setItem(NAV_REHEARSALS_KEY, canAccessRehearsals ? '1' : '0');
}

export function clearNavCache(): void {
  if (!browser) return;
  localStorage.removeItem(NAV_ADMIN_KEY);
  localStorage.removeItem(NAV_LOGGED_IN_KEY);
  localStorage.removeItem(NAV_REHEARSALS_KEY);
  localStorage.removeItem('kittens_can_write');
}

/** Re-run `/auth/me` (after login, or on app init). */
export async function initAuth(): Promise<void> {
  if (!browser) return;
  await queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey });
}

/** Local half of logging out (the server call is `useLogout` in `$lib/query/auth`): forget the token and drop all cached data. */
export function clearSession(): void {
  clearToken();
  clearNavCache();
  queryClient.setQueryData(meQueryOptions.queryKey, null);
  queryClient.removeQueries({ predicate: q => q.queryKey[0] !== 'auth' });
}

/** Approved admins and writers can view and manage rehearsals. */
export const canAccessRehearsals = derived(currentUser, $u => $u?.status === 'approved' && ($u.isAdmin === true || $u.role === 'writer'));

export function isAdmin(): boolean {
  return get(currentUser)?.isAdmin === true;
}

const CAN_WRITE_KEY = 'kittens_can_write';
const cachedCanWrite = browser && localStorage.getItem(CAN_WRITE_KEY) === '1';

/**
 * True for admins and writers; false for readers and unauthenticated users. Until `/auth/me` answers it falls back to the value of
 * the last session (cached), so write controls (➕, row actions…) are in the first paint instead of popping in later.
 */
export const canWrite = derived([currentUser, authLoading], ([$u, $loading], set) => {
  if ($u === null && $loading) { set(cachedCanWrite); return; }
  const value = $u?.isAdmin === true || ($u?.status === 'approved' && $u?.role === 'writer');
  if (browser) localStorage.setItem(CAN_WRITE_KEY, value ? '1' : '0');
  set(value);
}, cachedCanWrite);
