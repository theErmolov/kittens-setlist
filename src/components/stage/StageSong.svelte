<script lang="ts">
  import LinkifiedText from '$components/shared/LinkifiedText.svelte';
  import Note from '$components/shared/Note.svelte';
  import type { Song, SetlistEntry } from '$lib/types';
  import { t } from '$lib/i18n';
  import { createQuery } from '@tanstack/svelte-query';
  import { musiciansQuery } from '$lib/query/queries';
  import { useStageMark } from '$lib/query/stage';
  import { useStore } from '$lib/store/bridge';
  import { stageStore, stageCanMark, stageIsApproved } from '$lib/store/stage';
  import StageRow, { type RosterCell } from './StageRow.svelte';

  let {
    song,
    entry,
    position,
    startTime,
  }: {
    song: Song;
    entry: SetlistEntry;
    position: number;
    startTime?: string;
  } = $props();

  const musiciansQ = createQuery(() => ({ ...musiciansQuery(), enabled: $stageIsApproved }));
  const markMut = useStageMark(() => stageStore.getState().setlistId);
  const selectedMusicianStore = useStore(stageStore, s => s.selectedMusician);
  const canMark = stageCanMark;

  let musicians = $derived(musiciansQ.data ?? []);
  let selectedMusician = $derived($selectedMusicianStore);

  function ontoggle() {
    if (!$canMark || !entry.songId) return;
    markMut.mark({ kind: 'song', songId: entry.songId });
  }
  function onlyricsclick() { stageStore.getState().setLyricsSong(entry.songId ?? null); }

  let permanentNames = $derived(new Set(musicians.map(m => m.name)));

  // One cell per band musician (empty when they do not play, so the columns line up), then the ad-hoc guests.
  let rosterCells = $derived.by((): RosterCell[] => {
    const cells: RosterCell[] = musicians.map(m => {
      const instruments = song.musicians[m.name]?.instruments ?? [];
      return { name: m.name, instruments, highlight: !!selectedMusician && m.name === selectedMusician && instruments.length > 0 };
    });
    for (const [name, role] of Object.entries(song.musicians)) {
      if (!permanentNames.has(name) && role.instruments.length > 0) {
        cells.push({ name, instruments: role.instruments, highlight: !!selectedMusician && name === selectedMusician });
      }
    }
    return cells;
  });
</script>

<StageRow
  {song}
  {position}
  {startTime}
  played={!!entry.played}
  interactive={$canMark}
  onclick={ontoggle}
  onlyrics={onlyricsclick}
  cells={rosterCells}
  hasComment={!!(entry.comment || entry.personalComment)}
>
  {#snippet comment()}
    {#if entry.comment}<div><LinkifiedText text={entry.comment} /></div>{/if}
    <Note value={entry.personalComment} label={$t.common.personalComment} icon="🤫" />
  {/snippet}
</StageRow>
