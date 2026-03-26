<script lang="ts">
  import type { Song, Instrument, LearningStage } from '$lib/types';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import { t } from '$lib/i18n';
  import { sortInstruments, songReadiness } from '$lib/utils';

  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', percussion: '🪇', vocals: '🎤'
  };

  const STAGE_COLOR: Record<LearningStage, string> = {
    nothing: '#94a3b8', queue: '#cbd5e1', structure: '#f59e0b', mastering: '#3b82f6', ready: '#22c55e'
  };
  // Readiness badge: nothing is red (song not worked on yet)
  const READINESS_COLOR: Record<LearningStage, string> = {
    nothing: '#ef4444', queue: '#cbd5e1', structure: '#f59e0b', mastering: '#3b82f6', ready: '#22c55e'
  };

  let {
    song,
    allMusicians,
    selectedMusicians,
    onedit,
    ondelete,
    onaddtosetlist
  }: {
    song: Song;
    allMusicians: string[];
    selectedMusicians: Set<string>;
    onedit: () => void;
    ondelete: () => void;
    onaddtosetlist: () => void;
  } = $props();

  // Guests = musicians in this song not in the permanent roster, who have instruments
  let permanentSet = $derived(new Set(allMusicians));
  let guestTags = $derived(
    Object.entries(song.musicians)
      .filter(([name, role]) => !permanentSet.has(name) && role.instruments.length > 0)
      .map(([name, role]) => ({ name, icons: sortInstruments(role.instruments).map(i => instrumentIcons[i]).join('') }))
  );

  let readiness = $derived(songReadiness(song.musicians, song.progress ?? {}, selectedMusicians));
</script>

<tr class="song-row">
  <td class="td-cat">
    <span class="readiness-dot" style="background: {READINESS_COLOR[readiness]}" title={$t.progress[readiness]}></span>
    <CategoryBadge category={song.category} />
  </td>
  <td class="td-artist">{song.artist}</td>
  <td class="td-title">
    <span class="title-text">{song.title}</span>
    {#each guestTags as g}
      <span class="guest-tag">{g.icons} {g.name}</span>
    {/each}
  </td>
  {#each allMusicians as name, i}
    {@const role = song.musicians[name]}
    {@const stage = (song.progress?.[name] ?? 'nothing') as LearningStage}
    <td class="td-musician" class:musician-alt={i % 2 === 0}>
      <span class="prog-dot" style="background: {STAGE_COLOR[stage]}" title={$t.progress[stage]}></span>
      {#if role?.instruments?.length}
        <span class="inst-slot">{sortInstruments(role.instruments).map(i => instrumentIcons[i]).join('')}</span>
      {/if}
    </td>
  {/each}
  <td class="td-actions">
    <button class="action-btn" onclick={onedit} title={$t.song.editTitle}>✏️</button>
    <button class="action-btn" onclick={onaddtosetlist} title={$t.addToSetlist.title}>📋</button>
    <button class="action-btn danger" onclick={ondelete} title={$t.song.remove}>🗑</button>
  </td>
</tr>

<style>
  .song-row { border-bottom: 1px solid var(--border); }
  .song-row:hover { background: var(--row-hover); }
  td { padding: 8px 12px; font-size: 0.88rem; vertical-align: middle; overflow: hidden; }
  .td-cat { text-align: left; white-space: nowrap; }
  .td-artist { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .td-title { white-space: normal; }
  .title-text { vertical-align: middle; }
  .guest-tag {
    display: inline-block;
    background: var(--border);
    color: var(--text-muted);
    font-size: 0.7rem;
    padding: 1px 7px;
    border-radius: 10px;
    margin-left: 5px;
    white-space: nowrap;
    vertical-align: middle;
  }
  .td-musician { text-align: left; white-space: nowrap; }
  .musician-alt { background: var(--musician-alt-bg); }
  .inst-slot { font-size: 1.17rem; vertical-align: middle; }

  .readiness-dot {
    display: inline-block;
    width: 7px; height: 7px;
    border-radius: 50%;
    margin-right: 4px;
    vertical-align: middle;
    flex-shrink: 0;
  }

  .prog-dot {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    margin-right: 3px;
    vertical-align: middle;
    flex-shrink: 0;
  }

  .td-actions { white-space: nowrap; text-align: center; }
  .action-btn {
    background: none; border: none; cursor: pointer;
    padding: 4px 5px; border-radius: 4px; font-size: 1.2rem;
    opacity: 0.6; transition: opacity 0.12s;
  }
  .action-btn:hover { opacity: 1; }
  .action-btn.danger:hover { color: #ef4444; }
</style>
