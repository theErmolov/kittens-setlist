import { QueryCache, QueryClient } from '@tanstack/svelte-query';
import { readable } from 'svelte/store';
import { dev } from '$app/environment';
import { isAuthError } from '$lib/apiError';

export { isAuthError };

/** A mounted page query that is currently refused (401/403); nav extras opt out with `meta.ignoreForbidden`. */
const isDenied = (q: { getObserversCount: () => number; state: { error: unknown }; meta?: Record<string, unknown> }) =>
  q.getObserversCount() > 0 && isAuthError(q.state.error) && !q.meta?.ignoreForbidden;

/** Live "some page data is refused" flag for `AppShell`, derived from the query cache (so it clears itself when the query succeeds or unmounts). */
export const accessDenied = readable(false, set => {
  const cache = queryClient.getQueryCache();
  const update = () => {
    const denied = cache.getAll().filter(isDenied);
    if (dev && denied.length) console.warn('[access] refused:', denied.map(q => JSON.stringify(q.queryKey)).join(', '));
    set(denied.length > 0);
  };
  update();
  return cache.subscribe(update);
});

/** `refetchInterval` value that stops polling once the query has failed with 401/403. */
export const pollUnlessDenied = (interval: number | false | ((query: any) => number | false)) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (query: any): number | false =>
    isAuthError(query.state.error) ? false : typeof interval === 'function' ? interval(query) : interval;

/**
 * The single app-wide QueryClient. All data that comes from the backend lives
 * in its cache; UI-only state lives in the Zustand stores in `$lib/store`.
 *
 * 401/403 are never retried and never touch the stored token (only `/auth/me`
 * decides the session is invalid); pages show a "no access" notice instead.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache(),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, err) => !isAuthError(err) && failureCount < 1,
      refetchOnWindowFocus: true,
      retryOnMount: false,
    },
  },
});
