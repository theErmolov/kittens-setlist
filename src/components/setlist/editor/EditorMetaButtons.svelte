<script lang="ts">
  /** The ✏️ button that opens the setlist's edit dialog (name, date, time, comment, vibe). Writers only. */
  import IconButton from '$components/shared/IconButton.svelte';
  import { t } from '$lib/i18n';
  import { stripLeadingEmoji } from '$lib/utils';
  import { canWrite } from '$lib/auth';
  import { setlistEditorStore } from '$lib/store/setlistEditor';

  const actions = setlistEditorStore.getState();
</script>

{#if $canWrite}
  <IconButton text={stripLeadingEmoji($t.editor.edit)} icon="✏️" label={$t.editor.edit} class="border-0 bg-control-bg hover:bg-muted" onclick={() => actions.startEditMeta()} />
{/if}
