/**
 * Zustand → Svelte bridge.
 *
 * UI-only state lives in vanilla Zustand stores (`createStore` from
 * `zustand/vanilla`). `useStore(store, selector)` exposes a selected slice as a
 * Svelte readable, so components consume it with the usual `$slice` syntax and
 * update it by calling store actions (`store.getState().setX(...)`).
 *
 *   const filter = useStore(backlogStore, s => s.filter);   // in <script>
 *   {$filter}                                               // in markup
 */
import { readable, type Readable } from 'svelte/store';
import type { StoreApi } from 'zustand/vanilla';

export function useStore<S, T>(
  store: StoreApi<S>,
  selector: (state: S) => T,
  equals: (a: T, b: T) => boolean = Object.is,
): Readable<T> {
  return readable(selector(store.getState()), set => {
    let current = selector(store.getState());
    set(current);
    return store.subscribe(state => {
      const next = selector(state);
      if (!equals(current, next)) {
        current = next;
        set(next);
      }
    });
  });
}

/**
 * TanStack Query → Svelte readable, for module-level code that can't call
 * `createQuery` (it needs a component context), e.g. `$currentUser`.
 */
import { QueryObserver, type QueryClient, type QueryObserverResult, type QueryKey, type QueryObserverOptions } from '@tanstack/svelte-query';

export function queryStore<TData, TError = Error>(
  client: QueryClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any,
): Readable<QueryObserverResult<TData, TError>> {
  const observer = new QueryObserver<TData, TError, TData, TData, QueryKey>(client, options as QueryObserverOptions<TData, TError, TData, TData, QueryKey>);
  return readable(observer.getCurrentResult(), set => {
    set(observer.getCurrentResult());
    return observer.subscribe(set);
  });
}
