import { browser } from '$app/environment';
import { writable, derived, get } from 'svelte/store';
import type { KittensUser } from '$lib/types';
import { PUBLIC_API_URL } from '$env/static/public';

const TOKEN_KEY = 'auth_token';

export const currentUser = writable<KittensUser | null>(null);
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
      const user = await res.json() as KittensUser;
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
  currentUser.set(null);
}

export function isAdmin(): boolean {
  return get(currentUser)?.isAdmin === true;
}

/** True for admins and writers; false for readers and unauthenticated users. */
export const canWrite = derived(currentUser, $u =>
  $u?.isAdmin === true || ($u?.status === 'approved' && $u?.role === 'writer')
);
