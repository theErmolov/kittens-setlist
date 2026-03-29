<script lang="ts">
  import type { Song, Instrument, LearningStage } from '$lib/types';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import { t } from '$lib/i18n';
  import { sortInstruments, progressPct, pctBubbleStyle } from '$lib/utils';

  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', percussion: '🪇', vocals: '🎤'
  };

  const PROG_BG: Partial<Record<LearningStage, string>> = {
    nothing:   'rgba(234,179,8,0.18)',
    queue:     'rgba(234,179,8,0.18)',
    structure: 'rgba(192,80,77,0.18)',
    mastering: 'rgba(59,130,246,0.18)',
    ready:     'rgba(34,197,94,0.18)',
  };

  let {
    song,
    allMusicians,
    showProgress = false,
    onedit,
    ondelete,
    onaddtosetlist
  }: {
    song: Song;
    allMusicians: string[];
    showProgress?: boolean;
    onedit: () => void;
    ondelete: () => void;
    onaddtosetlist: () => void;
  } = $props();

  let overallPct = $derived.by(() => {
    const permMusicians = Object.fromEntries(
      allMusicians.filter(n => song.musicians[n]).map(n => [n, song.musicians[n]])
    );
    const active = Object.values(permMusicians).filter(r => r.instruments.length > 0);
    if (active.length === 0) return null;
    return progressPct(permMusicians, (song.progress ?? {}) as Record<string, LearningStage>);
  });

  // Guests = musicians in this song not in the permanent roster, who have instruments
  let permanentSet = $derived(new Set(allMusicians));
  let guestTags = $derived(
    Object.entries(song.musicians)
      .filter(([name, role]) => !permanentSet.has(name) && role.instruments.length > 0)
      .map(([name, role]) => ({ name, instruments: sortInstruments(role.instruments) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );
</script>

<tr class="song-row">
  <td class="td-cat">
    {#if showProgress && overallPct !== null}
      <span class="overall-pct" style={pctBubbleStyle(overallPct)}>{overallPct}%</span>
    {:else}
      <CategoryBadge category={song.category} iconOnly />
    {/if}
  </td>
  <td class="td-artist">{song.artist}</td>
  <td class="td-title">
    <span class="title-text">{song.title}</span>
    {#each guestTags as g}
      <span class="guest-tag"><span class="guest-icons">{#each g.instruments as inst (inst)}<span>{instrumentIcons[inst]}</span>{/each}</span><span class="guest-name">{g.name}</span></span>
    {/each}
  </td>
  {#each allMusicians as name, i}
    {@const role = song.musicians[name]}
    {@const stage = (song.progress?.[name] ?? 'nothing') as LearningStage}
    {@const progBg = showProgress && (role?.instruments?.length ?? 0) > 0 ? (PROG_BG[stage] ?? null) : null}
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
  .td-cat { text-align: center; white-space: nowrap; line-height: 1.2; padding: 6px 4px; }
  .td-cat :global(.badge.icon-only) { font-size: 1rem; padding: 3px 5px; }
  .overall-pct { display: block; font-size: 0.9rem; font-weight: 600; padding: 1px 4px; border-radius: 8px; white-space: nowrap; }
  .td-artist { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .td-title { white-space: normal; }
  .title-text { vertical-align: middle; }
  .guest-tag {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: var(--border);
    color: var(--text-muted);
    font-size: 0.7rem;
    padding: 1px 7px;
    border-radius: 10px;
    margin-left: 5px;
    vertical-align: middle;
  }
  .guest-icons { flex-shrink: 0; }
  .guest-name {
    max-width: 7ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
