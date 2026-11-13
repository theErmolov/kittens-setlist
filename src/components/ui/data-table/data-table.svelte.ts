import { createTable, type RowData, type TableOptions, type TableOptionsResolved, type TableState } from '@tanstack/table-core';

/**
 * Svelte 5 adapter for TanStack Table (the shadcn-svelte Data Table pattern).
 * Table state lives in the options you pass (`state` + `onXChange`): in this app that means a Zustand store,
 * as for every other piece of UI state.
 */
export function createSvelteTable<TData extends RowData>(options: TableOptions<TData>) {
  const resolvedOptions: TableOptionsResolved<TData> = mergeObjects(
    {
      state: {},
      onStateChange() {},
      renderFallbackValue: null,
      mergeOptions: (defaultOptions: TableOptions<TData>, o: Partial<TableOptions<TData>>) => mergeObjects(defaultOptions, o),
    },
    options,
  );

  const table = createTable(resolvedOptions);
  let state = $state<Partial<TableState>>(table.initialState);

  function updateOptions() {
    table.setOptions((prev) =>
      mergeObjects(prev, options, {
        state: mergeObjects(state, options.state || {}),
        onStateChange: (updater: unknown) => {
          if (updater instanceof Function) state = updater(state);
          else state = mergeObjects(state, updater as Partial<TableState>);
          options.onStateChange?.(updater as never);
        },
      }),
    );
  }

  updateOptions();
  $effect.pre(() => {
    // Re-run when reactive options (data, state, columns...) change.
    updateOptions();
  });

  return table;
}

type MaybeThunk<T extends object> = T | (() => T | null | undefined);
type Intersection<T extends readonly unknown[]> = (T extends [infer H, ...infer R] ? H & Intersection<R> : unknown) & {};

/** Merges objects lazily through a Proxy so getters (reactive reads) are preserved. */
export function mergeObjects<Sources extends readonly MaybeThunk<any>[]>(...sources: Sources): Intersection<{ [K in keyof Sources]: Sources[K] }> {
  const resolve = <T extends object>(src: MaybeThunk<T>): T | undefined => (typeof src === 'function' ? (src() ?? undefined) : src);
  const findSourceWithKey = (key: PropertyKey) => {
    for (let i = sources.length - 1; i >= 0; i--) {
      const obj = resolve(sources[i]);
      if (obj && key in obj) return obj;
    }
    return undefined;
  };

  return new Proxy(Object.create(null), {
    get(_, key) {
      const src = findSourceWithKey(key);
      return src?.[key as never];
    },
    has(_, key) {
      return !!findSourceWithKey(key);
    },
    ownKeys(): (string | symbol)[] {
      const all = new Set<string | symbol>();
      for (const s of sources) {
        const obj = resolve(s);
        if (obj) for (const k of Reflect.ownKeys(obj)) all.add(k);
      }
      return [...all];
    },
    getOwnPropertyDescriptor(_, key) {
      const src = findSourceWithKey(key);
      if (!src) return undefined;
      return { configurable: true, enumerable: true, value: (src as never)[key], writable: true };
    },
  }) as never;
}
