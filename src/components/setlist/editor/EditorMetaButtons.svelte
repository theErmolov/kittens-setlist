<script lang="ts">
  /** The ✏️ button that opens the setlist's edit dialog (name, date, time, comment, vibe). Writers only. */
  import IconButton from '$components/shared/IconButton.svelte';
  import { t } from '$lib/i18n';
  import { canWrite } from '$lib/auth';
  import { setlistEditorStore } from '$lib/store/setlistEditor';

  const actions = setlistEditorStore.getState();
</script>

{#if $canWrite}
  <IconButton icon="✏️" label={$t.editor.edit} class="border-0 bg-card hover:bg-muted" onclick={() => actions.startEditMeta()} />
{/if}
