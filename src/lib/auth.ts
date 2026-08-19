import { browser } from '$app/environment';
import { writable, derived, get } from 'svelte/store';
import type { User } from '$lib/types';
import { PUBLIC_API_URL } from '$env/static/public';

const TOKEN_KEY = 'auth_token';

export const currentUser = writable<User | null>(null);
export const authLoading = writable(true);

export function getToken(): string | null {
  if (!browser) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (!browser) return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (!browser) return;
  localStorage.removeItem(TOKEN_KEY);
}

// Cached auth-derived nav flags. The nav bar reads these on first paint so the
// icon count is stable before initAuth() resolves (avoids the reflow jump on
// mobile where links are flex:1 and the admin/logout chrome appears late).
const NAV_ADMIN_KEY = 'kittens_nav_admin';
const NAV_LOGGED_IN_KEY = 'kittens_nav_logged_in';

export function getCachedNavFlags(): { isAdmin: boolean; loggedIn: boolean } {
  if (!browser) return { isAdmin: false, loggedIn: false };
  return {
    isAdmin: localStorage.getItem(NAV_ADMIN_KEY) === '1',
    loggedIn: localStorage.getItem(NAV_LOGGED_IN_KEY) === '1',
  };
}

export function setCachedNavFlags({ isAdmin, loggedIn }: { isAdmin: boolean; loggedIn: boolean }): void {
  if (!browser) return;
  localStorage.setItem(NAV_ADMIN_KEY, isAdmin ? '1' : '0');
  localStorage.setItem(NAV_LOGGED_IN_KEY, loggedIn ? '1' : '0');
}

export function clearNavCache(): void {
  if (!browser) return;
  localStorage.removeItem(NAV_ADMIN_KEY);
  localStorage.removeItem(NAV_LOGGED_IN_KEY);
}

/** Fetch /auth/me and populate currentUser. Call once on app init. */
export async function initAuth(): Promise<void> {
  if (!browser) {
    authLoading.set(false);
    return;
  }
  const token = getToken();
  if (!token) {
    authLoading.set(false);
    return;
  }
  try {
    const res = await fetch(`${PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const user = await res.json() as User;
      currentUser.set(user);
    } else {
      clearToken();
    }
    authLoading.set(false);
  } catch {
    // network error — keep token, leave authLoading=true so the guard never
    // redirects to login; the app stays in loading state until the user refreshes
  }
}

export async function logout(): Promise<void> {
  const token = getToken();
  if (token) {
    try {
      await fetch(`${PUBLIC_API_URL}/auth/logout`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* ignore */ }
  }
  clearToken();
  clearNavCache();
  currentUser.set(null);
}

export function isAdmin(): boolean {
  return get(currentUser)?.isAdmin === true;
}

/** True for admins and writers; false for readers and unauthenticated users. */
export const canWrite = derived(currentUser, $u =>
  $u?.isAdmin === true || ($u?.status === 'approved' && $u?.role === 'writer')
);
