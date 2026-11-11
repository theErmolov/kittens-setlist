<script lang="ts">
  /** Everything that adds something to the setlist behind one ➕ button (top bar from the mid tier, bottom bar in the small tier): songs, breaks, a guest song, a new set. */
  import RowActions from '$components/shared/RowActions.svelte';
  import { t } from '$lib/i18n';
  import { useStore } from '$lib/store/bridge';
  import { setlistEditorStore } from '$lib/store/setlistEditor';
  import { useAddBreak } from '$lib/query/setlistMutations';

  const actions = setlistEditorStore.getState();
  const setlistId = useStore(setlistEditorStore, s => s.setlistId);
  const addBreak = useAddBreak();
</script>

<RowActions variant="default" icon="➕" label={$t.editor.add.replace(/^\+\s*/, '')} actions={[
  { icon: '🎵', label: $t.editor.addSongs, onselect: () => actions.patch({ showAddModal: true }) },
  ...[5, 10, 20, 30].map(min => ({ icon: '⏸', label: `${$t.editor.break}: ${$t.editor.minutes(min)}`, onselect: () => { void addBreak.mutateAsync({ setlistId: $setlistId!, minutes: min }); } })),
  { icon: '👤', label: $t.editor.addSetlistOnly, separatorBefore: true, onselect: () => actions.patch({ showSetlistOnlyModal: true }) },
  { icon: '⏭', label: $t.editor.newSubset, onselect: () => actions.newSubset($t.editor.subsetDefaultName) },
]} />
