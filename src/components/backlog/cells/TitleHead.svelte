<script lang="ts">
  /** Header of the combined "Artist – Title" column: both parts sort. */
  import { t } from '$lib/i18n';
  import SortHead from './SortHead.svelte';
</script>

<span class="inline-flex items-center gap-1">
  <SortHead id="artist" label={$t.backlog.cols.artist} />
  <span class="text-muted-foreground">–</span>
  <SortHead id="title" label={$t.backlog.cols.title} />
</span>
