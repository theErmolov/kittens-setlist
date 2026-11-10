# State architecture (TanStack Query + Zustand)

Rule: **data from the backend → TanStack Query; any UI state (filters, tabs, dropdowns, modals, form drafts, drag state, selections) → Zustand. No component-local `$state` for either.**

- `src/lib/query/client.ts` — the QueryClient. `src/lib/query/queries.ts` — read queries + `keys`. `src/lib/query/setlistMutations.ts` — setlist writes.
- `src/lib/store/bridge.ts` — `useStore(store, selector)` → Svelte readable (use `$slice` in markup); `queryStore()` for module-level query access.
- `src/lib/store/*.ts` — one vanilla Zustand store (`createStore` from `zustand/vanilla`) per feature, actions inside the store.
- API calls stay in `src/lib/api.ts`; never call it from components, only from queryFn/mutationFn.
- No prop drilling: components read the stores / queries they need directly instead of receiving data props.

# UI architecture (shadcn-svelte + Tailwind v4)

- Components live in `src/components/ui/*` (shadcn-svelte, all installed — **do not run the shadcn CLI**, everything needed is there). Import like `import { Button } from '$components/ui/button'`; compose with `cn()` from `$lib/utils`.
- Tailwind v4 is set up in `src/app.css`. shadcn tokens (`bg-background`, `text-foreground`, `bg-primary`, `bg-card`, `bg-popover`, `text-muted-foreground`, `border-border`, `bg-accent` = hover surface, `bg-destructive`, `ring-ring`) are mapped onto the app's own palette (`--bg`, `--surface`, `--text`, `--accent` = brand purple, …), so light/dark themes (`[data-theme="dark"]`) and brand colours carry over. Use the shadcn tokens in new markup; never hard-code colours.
- Use shadcn components for every standard control: `Button` (default = primary/purple, `outline`, `secondary`, `ghost`, `destructive`; sizes `sm`/`default`/`lg`/`icon`), `Input`, `Textarea`, `Label`, `Checkbox`, `Switch`, `Select`, `Tabs`, `Dialog` / `AlertDialog` (all modals), `Popover` / `Tooltip` (anchored tips — use `Popover` with a `customAnchor`/trigger, not hand-positioned divs), `Badge`, `Toggle`/`ToggleGroup` (filter chips, mode toggles), `Table` (plain data tables), `Card`, `Separator`, `DropdownMenu`, `Calendar` (date pickers; keep ISO storage and the localized `formatDate` display).
- Keep custom (domain-specific, no shadcn equivalent): the song row/table (`SongEntryRow` + `songTable.css`, drag & drop), `LoadingCat` (mandatory loading indicator), `LyricsOverlay`, the rehearsal calendar grid, emoji rendering. Emoji stay the app's icons (Noto SVG rule in AGENTS.md); lucide icons only inside shadcn internals.
- Overlay/open state is UI state → Zustand (`open={$slice}` + `onOpenChange`), as before. No component-local `$state`.
- Behaviour, i18n (RU/EN), role gates, accessibility labels, mobile (≥16px inputs; modals fill the viewport edge to edge on mobile) must stay exactly as they are — this is a visual/component migration only.
- Plain `<style>` blocks may remain only for layout that Tailwind classes can't express cleanly (grid-template of custom tables, drag states). Remove styles that duplicate what a shadcn component now provides.

# Data Table (TanStack Table v8 + shadcn Table)

Every table in the app is a shadcn **Data Table**: `@tanstack/table-core` (v8) driven through the helpers in `src/components/ui/data-table` (`createSvelteTable`, `FlexRender`, `renderComponent`, `renderSnippet`), rendered with the shadcn `Table.*` parts.
- Define **column defs** (`ColumnDef<Row>[]`, `accessorKey`/`accessorFn`, `header`, `cell`, `sortingFn`, `meta`) once per table; build rows from the data (view-model objects when rows are heterogeneous, e.g. `{ kind: 'subset' | 'break' | 'song', ... }`).
- `const table = createSvelteTable({ get data() {...}, columns, state: { get sorting() {...} }, onSortingChange: updater => store.setSorting(...), getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), ... })`. **Table state (sorting, pagination, column visibility, expansion…) lives in the Zustand store**, not in component state; pass it through `state` getters + `onXChange`.
- Render: `table.getHeaderGroups()` → `<Table.Head>` + `<FlexRender content={header.column.columnDef.header} context={header.getContext()} />`; `table.getRowModel().rows` → `<Table.Row>` + `row.getVisibleCells()` → `<Table.Cell>` + `FlexRender` of `cell.column.columnDef.cell`.
- Dynamic columns (musicians) are generated from data; hidden/unused columns via `columnVisibility` state.
- Custom rows (drag handles, subset/break/hint rows, expandable detail rows) are rendered by the page around the row model; per-row DOM attributes (`draggable`, `data-row-key`, drag handlers) stay on `<Table.Row>`.
- Server/cursor pagination (audit log): `manualPagination: true` with the TanStack Query cursor flow.
- Keep existing behaviour/looks, sorting rules (English artists before Russian), sticky headers, column borders, icon-fit cells, role gates, i18n.
