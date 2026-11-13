import type { Song } from '$lib/types';
import type { RowAction } from '$components/shared/RowActions.svelte';
import { backlogStore } from '$lib/store/backlog';

/** The ⋯ menu of a catalog song (shared by the table row and the mobile list): writes for writers (the lyrics 📝 stays a visible button). */
export function songActions(song: Song, t: { song: { editTitle: string; remove: string }; addToSetlist: { title: string } }, canWrite: boolean): RowAction[] {
  const store = backlogStore.getState();
  return [
    ...(canWrite ? [
      { icon: '✏️', label: t.song.editTitle, onselect: () => store.setEditingSong(song.id) },
      { icon: '📋', label: t.addToSetlist.title, onselect: () => store.requestAdd(song.id) },
      { icon: '🗑️', label: t.song.remove, destructive: true, separatorBefore: true, onselect: () => store.requestDelete(song.id) },
    ] : []),
  ];
}
