<script lang="ts">
  import type { Song, Instrument, LearningStage } from '$lib/types';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import { t } from '$lib/i18n';
  import { sortInstruments, progressPct, pctBubbleStyle } from '$lib/utils';

  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', percussion: '🪇', vocals: '🎤'
  };

  const PROG_BG: Partial<Record<LearningStage, string>> = {
    queue:     'rgba(128,128,128,0.2)',
    structure: 'rgba(255,0,0,0.2)',
    mastering: 'rgba(255,220,0,0.2)',
    ready:     'rgba(0,200,0,0.2)',
  };

  const PROG_COLOR: Partial<Record<LearningStage, string>> = {
    queue:     '#424242',
    structure: '#8A000A',
    mastering: '#856100',
    ready:     '#005909',
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

  let mobileBubbles = $derived.by(() => {
    const out: Array<{ name: string; instruments: Instrument[]; progBg: string | null; progColor: string | null; isGuest: boolean }> = [];
    for (const name of allMusicians) {
      const role = song.musicians[name];
      if (!role?.instruments?.length) continue;
      const stage = (song.progress?.[name] ?? 'queue') as LearningStage;
      const progBg = showProgress ? (PROG_BG[stage] ?? null) : '#fcd34d40';
      const progColor = showProgress ? (PROG_COLOR[stage] ?? null) : null;
      out.push({ name, instruments: sortInstruments(role.instruments), progBg, progColor, isGuest: false });
    }
    for (const g of guestTags) {
      out.push({ name: g.name, instruments: g.instruments, progBg: null, progColor: null, isGuest: true });
    }
    return out;
  });
</script>

<tr class="song-row" onclick={onedit}>
  <td class="td-cat desktop-only">
    {#if showProgress && overallPct !== null}
      <span class="overall-pct" style={pctBubbleStyle(overallPct)}>{overallPct}%</span>
    {:else}
      <CategoryBadge category={song.category} iconOnly />
    {/if}
  </td>
  <td class="td-artist desktop-only">{song.artist}</td>
  <td class="td-title">
    <div class="mobile-song-header">
      {#if showProgress && overallPct !== null}
        <span class="overall-pct" style={pctBubbleStyle(overallPct)}>{overallPct}%</span>
      {:else}
        <span class="mobile-cat"><CategoryBadge category={song.category} iconOnly /></span>
      {/if}
      <span class="mobile-artist">{song.artist}</span>
      <span class="mobile-sep">–</span>
      <span class="mobile-title">{song.title}</span>
    </div>
    <span class="title-text desktop-only">{song.title}</span>
    {#each guestTags as g}
      <span class="guest-tag desktop-only"><span class="guest-icons">{#each g.instruments as inst (inst)}<span>{instrumentIcons[inst]}</span>{/each}</span><span class="guest-name">{g.name}</span></span>
    {/each}
    {#if mobileBubbles.length > 0}
      <div class="mobile-musicians">
        {#each mobileBubbles as b}
          <span class="mob-bubble" class:mob-guest={b.isGuest} style={[b.progBg ? `background: ${b.progBg}` : '', b.progColor ? `color: ${b.progColor}` : ''].filter(Boolean).join('; ')}>
            <span class="mob-icons">{#each b.instruments as inst (inst)}<span>{instrumentIcons[inst]}</span>{/each}</span>
            <span class="mob-name">{b.name}</span>
          </span>
        {/each}
      </div>
    {/if}
  </td>
  {#each allMusicians as name, i}
    {@const role = song.musicians[name]}
    {@const stage = (song.progress?.[name] ?? 'queue') as LearningStage}
    {@const progBg = showProgress && (role?.instruments?.length ?? 0) > 0 ? (PROG_BG[stage] ?? null) : null}
    <td
      class="td-musician"
      class:musician-alt={i % 2 === 0 && !progBg}
      style={progBg ? `background: ${progBg}` : ''}
    >
      {#if role?.instruments?.length}
        <span class="inst-slot">{#each sortInstruments(role.instruments) as inst (inst)}<span>{instrumentIcons[inst]}</span>{/each}</span>
      {/if}
    </td>
  {/each}
  <td class="td-actions">
    <button class="action-btn action-edit" onclick={(e) => { e.stopPropagation(); onedit(); }} title={$t.song.editTitle}>✏️</button>
    <button class="action-btn action-addset" onclick={(e) => { e.stopPropagation(); onaddtosetlist(); }} title={$t.addToSetlist.title}>📋</button>
    <button class="action-btn action-del danger" onclick={(e) => { e.stopPropagation(); ondelete(); }} title={$t.song.remove}>🗑</button>
  </td>
</tr>

<style>
  .song-row { border-bottom: 1px solid var(--border); }
  @media (hover: hover) {
    .song-row:hover { background: var(--row-hover); }
  }
  @media (hover: none) {
    .song-row:active { background: var(--row-hover); }
  }
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

  .mobile-musicians { display: none; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
  .mob-bubble {
    display: inline-flex; align-items: center; gap: 3px;
    border-radius: 6px; padding: 1px 6px 1px 3px;
    font-size: 0.82rem; color: var(--text-muted);
  }
  .mob-bubble.mob-guest { border: 1px dashed var(--border); }
  .mob-icons { font-size: 1rem; flex-shrink: 0; }
  .mob-name {
    white-space: nowrap;
    overflow: hidden;
    flex: 1;
    min-width: 0;
    -webkit-mask-image: linear-gradient(to right, black calc(100% - 20px), transparent 100%);
    mask-image: linear-gradient(to right, black calc(100% - 20px), transparent 100%);
  }
  :global([data-theme="dark"]) .mob-bubble:not(.mob-guest) { background: #78350f; }

  .td-actions { white-space: nowrap; text-align: center; }
  .action-btn {
    background: none; border: none; cursor: pointer;
    padding: 4px 5px; border-radius: 4px; font-size: 1.2rem;
    opacity: 0.6; transition: opacity 0.12s;
  }
  .action-btn:hover { opacity: 1; }
  .action-btn.danger:hover { color: #ef4444; }

  .mobile-song-header { display: none; line-height: 1.5; }
  .mobile-song-header .overall-pct { display: inline; padding: 1px 5px; }
  .mobile-cat { vertical-align: middle; margin-right: 2px; }
  .mobile-artist { font-weight: 500; font-size: 0.88rem; }
  .mobile-sep { color: var(--text-muted); margin: 0 2px; }
  .mobile-title { font-weight: 600; font-size: 0.88rem; }

  @media (max-width: 700px) {
    /* Break out of table — row becomes a flex card */
    tr.song-row { display: flex; align-items: flex-start; gap: 6px; padding: 8px 4px; cursor: pointer; }
    tr.song-row td { cursor: pointer; }
    .desktop-only { display: none !important; }
    .td-musician { display: none !important; }
    .td-title { flex: 1; padding: 4px 0; min-width: 0; overflow: visible; }
    .td-actions { display: none; }
    /* Song header: inline text, icon + artist – title */
    .mobile-song-header { display: block; }
    /* Musician bubbles: 3-per-row grid, equal width */
    .mobile-musicians {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      margin-top: 6px;
    }
    .mob-bubble { display: flex; width: 100%; box-sizing: border-box; min-width: 0; overflow: hidden; }
  }
</style>
