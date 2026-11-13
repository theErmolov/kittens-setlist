/** Tailwind class bundles shared by the editor/stage chrome so the shadcn controls keep the app's established scale. */

/** Pill filter chip (Toggle): shape + pressed colours only; the size is the global 40px control size. */
export const chip =
  'border border-border font-medium text-muted-foreground ' +
  'hover:border-primary hover:bg-transparent hover:text-primary-ink ' +
  'on:border-primary on:bg-primary on:text-primary-foreground ' +
  'on:hover:bg-primary on:hover:text-primary-foreground';
/** Pressed colour for icon toggles (filled with the secondary colour). */
export const pressedOn =
  'on:border-secondary on:bg-secondary on:text-secondary-foreground on:hover:bg-secondary/90';

/* ── Song table (setlist editor + rehearsal page): shadcn Table + Tailwind ───────────── */

/** Scroll container around the Table (the shadcn table-container must not become the scroller, or sticky headers break). */
export const songTableWrap =
  'min-h-0 flex-1 overflow-auto p-0 max-mid:overflow-x-hidden [&_[data-slot=table-container]]:overflow-visible';
