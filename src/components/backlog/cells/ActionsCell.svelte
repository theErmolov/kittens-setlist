<script lang="ts">
  import type { Song } from '$lib/types';
  import { t } from '$lib/i18n';
  import { canWrite } from '$lib/auth';
  import { useStore } from '$lib/store/bridge';
  import { noteStore } from '$lib/store/shell';
  import { backlogStore } from '$lib/store/backlog';
  import RowActions from '$components/shared/RowActions.svelte';
  import IconButton from '$components/shared/IconButton.svelte';
  import ButtonRow from '$components/shared/ButtonRow.svelte';
  import { songActions } from '../songActions';

  let { song }: { song: Song } = $props();
  /** Small and mid screens: the actions stay behind one ⋯ menu / drawer. */
  const narrow = useStore(noteStore, s => s.narrow);
  const store = backlogStore.getState();
  const flat = 'border-0 bg-transparent hover:bg-foreground/5';
</script>

<!-- Big: edit / add to setlist / delete are three separate icon buttons. Below: one 🔧 menu that fills the whole cell height, so rows of any height leave no gaps. -->
<ButtonRow justify="end" class="min-mid:h-full">
  {#if !$narrow && $canWrite}
    <IconButton icon="✏️" label={$t.song.editTitle} class={flat} onclick={(e) => { e.stopPropagation(); store.setEditingSong(song.id); }} />
    <IconButton icon="📋" label={$t.addToSetlist.title} class={flat} onclick={(e) => { e.stopPropagation(); store.requestAdd(song.id); }} />
    <IconButton icon="🗑️" label={$t.song.remove} class="{flat} hover:text-destructive" onclick={(e) => { e.stopPropagation(); store.requestDelete(song.id); }} />
  {:else}
    <RowActions drawer class="min-mid:h-full min-mid:rounded-none" actions={songActions(song, $t, $canWrite)} />
  {/if}
</ButtonRow>
