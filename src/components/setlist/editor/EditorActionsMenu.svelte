<script lang="ts">
  /** All writer actions of a setlist behind one ⋯ button (top bar from 701px, bottom bar below): comment, add songs, edit, breaks, guest song, new set. */
  import RowActions from '$components/shared/RowActions.svelte';
  import { t } from '$lib/i18n';
  import { useStore } from '$lib/store/bridge';
  import { setlistEditorStore } from '$lib/store/setlistEditor';
  import { useAddBreak } from '$lib/query/setlistMutations';
  import { useEditorData } from './editorData.svelte';

  const data = useEditorData();
  const actions = setlistEditorStore.getState();
  const setlistId = useStore(setlistEditorStore, s => s.setlistId);
  const addBreak = useAddBreak();
</script>

<RowActions actions={[
  { icon: '💬', label: data.comment ? $t.common.setlistComment : $t.common.addComment, onselect: () => actions.patch({ editingComment: true, draftComment: data.comment }) },
  { icon: '🎵', label: $t.editor.addSongs, onselect: () => actions.patch({ showAddModal: true }) },
  { icon: '✏️', label: $t.editor.edit, onselect: () => actions.startEditMeta() },
  ...[5, 10, 20, 30].map(min => ({ icon: '⏸', label: `${$t.editor.break}: ${$t.editor.minutes(min)}`, onselect: () => { void addBreak.mutateAsync({ setlistId: $setlistId!, minutes: min }); } })),
  { icon: '👤', label: $t.editor.addSetlistOnly, separatorBefore: true, onselect: () => actions.patch({ showSetlistOnlyModal: true }) },
  { icon: '⏭', label: $t.editor.newSubset, onselect: () => actions.newSubset($t.editor.subsetDefaultName) },
]} />
