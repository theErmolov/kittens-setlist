<script lang="ts">
  /** The setlist's 💬 comment viewer/editor and ✏️ edit buttons (top bar from 701px, bottom bar below). */
  import IconButton from '$components/shared/IconButton.svelte';
  import { t } from '$lib/i18n';
  import { canWrite } from '$lib/auth';
  import { setlistEditorStore } from '$lib/store/setlistEditor';
  import { notePopoverStore } from '$lib/store/notePopover';
  import { useEditorData } from './editorData.svelte';

  let { edit = true }: { edit?: boolean } = $props();
  const data = useEditorData();
  const actions = setlistEditorStore.getState();
</script>

{#if $canWrite || data.comment}
  <!-- Same viewer as the 🤫 personal notes; writers get an edit button inside it, or open the editor directly when there is no comment yet. -->
  <IconButton icon="💬" label={data.comment ? $t.common.setlistComment : $t.common.addComment} onclick={(e) => {
    const editComment = () => actions.patch({ editingComment: true, draftComment: data.comment });
    if (!data.comment) return editComment();
    notePopoverStore.getState().toggle('setlist-comment', data.comment, e.currentTarget as HTMLElement, { icon: '💬', title: $t.common.setlistComment, ...($canWrite ? { onedit: editComment, editLabel: `${$t.common.edit} · ${$t.common.setlistComment}` } : {}) });
  }} />
{/if}
{#if $canWrite && edit}
  <IconButton icon="✏️" label={$t.editor.edit} onclick={() => actions.startEditMeta()} />
{/if}
