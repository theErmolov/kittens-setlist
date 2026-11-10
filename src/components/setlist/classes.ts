/** Tailwind class bundles shared by the editor/stage chrome so the shadcn controls keep the app's established scale. */

/** Pill filter chip (Toggle): shape + pressed colours only; the size is the global 40px control size. */
export const chip =
  'border border-border font-medium text-muted-foreground ' +
  'hover:border-primary hover:bg-transparent hover:text-primary-ink ' +
  'data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground ' +
  'data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground';
/** Pressed colour for icon toggles (filled with the brand colour). */
export const pressedOn =
  'data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90';

/* ── Song table (setlist editor + rehearsal page): shadcn Table + Tailwind ───────────── */

/** Scroll container around the Table (the shadcn table-container must not become the scroller, or sticky headers break). */
export const songTableWrap =
  'min-h-0 flex-1 overflow-auto px-4 pb-4 max-[700px]:overflow-x-hidden max-[700px]:px-0 max-[700px]:pb-0 [&_[data-slot=table-container]]:overflow-visible';
