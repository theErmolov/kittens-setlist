<script lang="ts">
  /**
   * The song filter of the setlist editor and the rehearsal page: on mid/big an expanding bar under the top navigation
   * (the people on line 1, search + extra toggles on line 2), on small a compact bottom drawer with the same content.
   * The caller supplies the people filter (it renders for the `'inline'` bar or the `'stacked'` drawer) and the extra toggles.
   */
  import type { Snippet } from 'svelte';
  import { Separator } from '$components/ui/separator';
  import SearchInput from './SearchInput.svelte';
  import FilterDrawer from './FilterDrawer.svelte';
  import { t } from '$lib/i18n';
  import { cn } from '$lib/utils';

  let { open, mobile, onopenchange, search, onsearch, people, extras, id, class: className }: {
    open: boolean;
    /** Small screens: the drawer shows instead of the bar. */
    mobile: boolean;
    onopenchange: (open: boolean) => void;
    search: string;
    onsearch: (text: string) => void;
    people: Snippet<['inline' | 'stacked']>;
    extras: Snippet;
    id?: string;
    /** Classes of the desktop bar (border, padding, gap). */
    class?: string;
  } = $props();
</script>

<!-- Mid and big: the filter expands the bar under the top navigation. -->
<div {id} class={cn('shrink-0 flex-col max-mid:hidden', open ? 'flex' : 'hidden', className)}>
  {@render people('inline')}
  <div class="flex flex-wrap items-center gap-1.5">
    <SearchInput class="w-55 bg-transparent" label={$t.editor.search} value={search} onchange={onsearch} />
    {@render extras()}
  </div>
</div>

<!-- Small screens: a compact bottom drawer with the same filters. -->
<FilterDrawer open={open && mobile} onOpenChange={onopenchange} title={$t.editor.filter}>
  <SearchInput class="w-full bg-transparent" label={$t.editor.searchFull} value={search} onchange={onsearch} />
  <Separator class="my-0.5" />
  {@render people('stacked')}
  <div class="flex flex-wrap gap-1.5">{@render extras()}</div>
</FilterDrawer>
