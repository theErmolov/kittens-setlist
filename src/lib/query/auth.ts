/** Auth mutations: Telegram login and logout. */
import { createMutation } from '@tanstack/svelte-query';
import * as api from '$lib/api';
import { clearSession } from '$lib/auth';

export const useTelegramLogin = () =>
  createMutation(() => ({ mutationFn: (data: Record<string, string>) => api.telegramLogin(data) }));

/** Logs out server-side (failures ignored), then always clears the local session. */
export const useLogout = () =>
  createMutation(() => ({
    mutationFn: () => api.logoutRequest().catch(() => {}),
    onSettled: clearSession,
  }));
