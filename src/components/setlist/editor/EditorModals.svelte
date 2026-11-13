<script lang="ts">
  import AddSongsModal from '../AddSongsModal.svelte';
  import SongEditModal from '$components/backlog/SongEditModal.svelte';
  import LyricsOverlay from '$components/stage/LyricsOverlay.svelte';
  import { canWrite, currentUser } from '$lib/auth';
  import { useStore } from '$lib/store/bridge';
  import { setlistEditorStore } from '$lib/store/setlistEditor';
  import { useAddSongs, useAddSetlistOnlySong, useRemoveSong, useUpdateEntryComment, useUpdateEntrySong } from '$lib/query/setlistMutations';
  import { useUpdatePersonalEntryComment, useSyncEntryToCatalog } from '$lib/query/setlistEditor';
  import { keys } from '$lib/query/queries';
  import { queryClient } from '$lib/query/client';
  import type { Song, SetlistEntry, Setlist } from '$lib/types';
  import { useEditorData } from './editorData.svelte';

  const data = useEditorData();
  const actions = setlistEditorStore.getState();
  const showAddModal = useStore(setlistEditorStore, s => s.showAddModal);
  const showSetlistOnlyModal = useStore(setlistEditorStore, s => s.showSetlistOnlyModal);
  const lyricsViewEntryId = useStore(setlistEditorStore, s => s.lyricsViewEntryId);
  const editingEntryId = useStore(setlistEditorStore, s => s.editingEntryId);
  const lyricsViewEntry = $derived($lyricsViewEntryId ? data.entries.find(e => e.songId === $lyricsViewEntryId) ?? null : null);
  const editingEntry = $derived($editingEntryId ? data.entries.find(e => e.songId === $editingEntryId) ?? null : null);

  const addSongs = useAddSongs();
  const addSetlistOnly = useAddSetlistOnlySong();
  const removeSong = useRemoveSong();
  const updateEntryComment = useUpdateEntryComment();
  const updateEntrySong = useUpdateEntrySong();
  const updatePersonalComment = useUpdatePersonalEntryComment();
  const syncToCatalog = useSyncEntryToCatalog();

  /** Optimistic edit of the cached setlist's entries (the server response replaces it). */
  function patchCached(setlistId: string, fn: (entries: SetlistEntry[]) => SetlistEntry[]) {
    queryClient.setQueryData<Setlist>(keys.setlist(setlistId), sl => (sl ? { ...sl, entries: fn(sl.entries) } : sl));
  }

  const getId = () => setlistEditorStore.getState().setlistId!;

  async function handleAdd(songs: Song[]) {
    const setlistId = getId();
    const updated = await addSongs.mutateAsync({ setlistId, songs });
    actions.patch({ showAddModal: false });

    // Copy song.comment → entry comment for newly added songs that have one
    const addedIds = new Set(songs.map(s => s.id));
    const toComment = updated.entries
      .filter(e => e.songId && addedIds.has(e.songId) && e.song?.comment)
      .map(e => ({ order: e.order, comment: e.song!.comment! }));

    for (const { order, comment } of toComment) {
      await updateEntryComment.mutateAsync({ setlistId, order, comment });
    }
  }

  async function handleAddSetlistOnly(song: Song) {
    const setlistId = getId();
    const before = data.entries;
    const updated = await addSetlistOnly.mutateAsync({ setlistId, song });
    const entry = updated.entries.find(item => item.setlistOnly && !before.some(existing => existing.songId === item.songId));
    if (entry?.songId && song.personalComment) {
      await updatePersonalComment.mutateAsync({ setlistId, songId: entry.songId, comment: song.personalComment });
      entry.personalComment = song.personalComment;
    }
    queryClient.setQueryData(keys.setlist(setlistId), updated);
    actions.patch({ showSetlistOnlyModal: false });
  }

  async function handleRemove(songId: string) {
    await removeSong.mutateAsync({ setlistId: getId(), songId });
  }

  async function handleEntrySave(updatedSong: Song) {
    const entry = editingEntry;
    if (!entry) return;
    const setlistId = getId();
    const personalComment = updatedSong.personalComment ?? '';
    // Like lyrics, saving this snapshot writes the author's note back to the catalog.
    await updatePersonalComment.mutateAsync({ setlistId, songId: entry.songId!, comment: personalComment });
    patchCached(setlistId, es => es.map(item => item.songId === entry.songId ? { ...item, personalComment } : item));
    if (!$canWrite) { actions.patch({ editingEntryId: null }); return; }
    // Optimistic update — reflect changes immediately before API round-trips
    patchCached(setlistId, es => es.map(e =>
      e.order === entry.order ? { ...e, song: updatedSong, comment: updatedSong.comment ?? e.comment ?? '' } : e
    ));
    await updateEntrySong.mutateAsync({ setlistId, order: entry.order, song: updatedSong });
    await updateEntryComment.mutateAsync({ setlistId, order: entry.order, comment: updatedSong.comment ?? '' });
    // Sync progress and lengthMinutes back to the canonical backlog song.
    if (entry.songId && !entry.setlistOnly) {
      try {
        await syncToCatalog.mutateAsync({ songId: entry.songId, edited: updatedSong });
      } catch (err) {
        console.error('Failed to sync song changes to backlog:', err);
      }
    }
    actions.patch({ editingEntryId: null });
  }

  async function saveSetlistOnlyTranspose(entry: SetlistEntry, song: Song): Promise<Song> {
    const updated = await updateEntrySong.mutateAsync({ setlistId: getId(), order: entry.order, song });
    return updated.entries.find(candidate => candidate.songId === entry.songId)?.song ?? song;
  }
</script>

{#if $showAddModal && $canWrite}
  <AddSongsModal
    songs={data.songs}
    existingIds={data.existingIds}
    onclose={() => actions.patch({ showAddModal: false })}
    onadd={handleAdd}
    onaddnew={() => actions.patch({ showAddModal: false, showSetlistOnlyModal: true })}
  />
{/if}

{#if $showSetlistOnlyModal && $canWrite}
  <SongEditModal
    song={null}
    musicians={data.musicians}
    mode="setlist-only"
    onclose={() => actions.patch({ showSetlistOnlyModal: false })}
    onsave={handleAddSetlistOnly}
  />
{/if}

{#if lyricsViewEntry?.song}
  <LyricsOverlay
    song={lyricsViewEntry.song}
    onclose={() => actions.patch({ lyricsViewEntryId: null })}
    onsavetranspose={lyricsViewEntry.setlistOnly
      ? (song) => saveSetlistOnlyTranspose(lyricsViewEntry!, song)
      : undefined}
  />
{/if}

{#if editingEntry && $currentUser?.status === 'approved'}
  <SongEditModal
    song={editingEntry.song ? { ...editingEntry.song, comment: editingEntry.comment ?? '', personalComment: editingEntry.personalComment ?? '' } : null}
    personalOnly={!$canWrite}
    musicians={data.musicians}
    mode={editingEntry.setlistOnly ? 'setlist-only' : 'entry'}
    onclose={() => actions.patch({ editingEntryId: null })}
    onsave={handleEntrySave}
    onremove={$canWrite && editingEntry.songId ? () => { handleRemove(editingEntry!.songId!); } : undefined}
  />
{/if}
