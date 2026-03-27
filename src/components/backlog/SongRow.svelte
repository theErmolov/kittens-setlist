<script lang="ts">
  import type { Song, Instrument, LearningStage } from '$lib/types';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import { t } from '$lib/i18n';
  import { sortInstruments } from '$lib/utils';

  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', percussion: '🪇', vocals: '🎤'
  };

  const PROG_BG: Partial<Record<LearningStage, string>> = {
    structure: 'rgba(192,80,77,0.18)',
    mastering: 'rgba(59,130,246,0.18)',
    ready:     'rgba(34,197,94,0.18)',
  };

  let {
    song,
    allMusicians,
    selectedMusicians = new Set<string>(),
    onedit,
    ondelete,
    onaddtosetlist
  }: {
    song: Song;
    allMusicians: string[];
    selectedMusicians?: Set<string>;
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
</script>

<tr class="song-row">
  <td class="td-cat">
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
    {@const progBg = selectedMusicians.has(name) ? (PROG_BG[stage] ?? null) : null}
    <td
      class="td-musician"
      class:musician-alt={i % 2 === 0 && !progBg}
      style={progBg ? `background: ${progBg}` : ''}
    >
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

  .td-actions { white-space: nowrap; text-align: center; }
  .action-btn {
    background: none; border: none; cursor: pointer;
    padding: 4px 5px; border-radius: 4px; font-size: 1.2rem;
    opacity: 0.6; transition: opacity 0.12s;
  }
  .action-btn:hover { opacity: 1; }
  .action-btn.danger:hover { color: #ef4444; }
</style>
