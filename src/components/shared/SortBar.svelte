<script lang="ts">
  import ButtonRow from '$components/shared/ButtonRow.svelte';
  import { t } from '$lib/i18n';
  import * as ToggleGroup from '$components/ui/toggle-group';

  export type SortKey = 'artist' | 'title' | 'default';

  let {
    sort,
    onchange
  }: {
    sort: SortKey;
    onchange: (v: SortKey) => void;
  } = $props();
</script>

<ButtonRow>
  <span class="mr-0.5 text-[0.78rem] text-muted-foreground">{$t.sort.label}</span>
  <ToggleGroup.Root type="single" variant="outline" size="sm" spacing={2} value={sort} aria-label={$t.sort.label}
    onValueChange={(v: string) => { if (v) onchange(v as SortKey); }}>
    {#each (['default', 'artist', 'title'] as SortKey[]) as key}
      <ToggleGroup.Item
        value={key}
        class="sort-btn px-3 text-[0.78rem] font-normal text-muted-foreground hover:border-primary hover:bg-transparent hover:text-primary-ink data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground"
      >{$t.sort[key]}</ToggleGroup.Item>
    {/each}
  </ToggleGroup.Root>
</ButtonRow>
