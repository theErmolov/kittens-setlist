<script lang="ts">
  import RehearsalSongName from './RehearsalSongName.svelte';
  import RehearsalReadiness from './RehearsalReadiness.svelte';
  import { untrack, type Snippet } from 'svelte';
  import { orderMusicianNames } from '$lib/utils';
  import type { BandMusician, RehearsalSong, Song, Setlist } from '$lib/types';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { rehearsalReadiness, rehearsalSongKey, rehearsalCoverage, compareRehearsalSongs } from '$lib/rehearsals';
  let { setlist, catalog, musicians, attendees, attendanceOverrides = $bindable(), selected = $bindable(), details, disabled = false }: {
    setlist?: Setlist; catalog: Song[]; musicians: BandMusician[]; attendees: string[]; attendanceOverrides: Record<string, boolean>; selected: RehearsalSong[];
    details: Snippet; disabled?: boolean;
  } = $props();
  let source = $state(untrack(() => setlist ? 'setlist' : 'catalog'));
  let search = $state(''), guest = $state('');
  let guests = $state<string[]>([]);
  const candidates = $derived(source === 'selected' ? selected : source === 'setlist' && setlist
    ? [...setlist.entries].sort((a,b) => a.order - b.order).filter(e => e.song && e.songId).map(e => ({ songId: e.songId!, sourceSetlistId: setlist.id, song: { ...e.song!, progress: { ...(e.progress ?? {}), ...(e.song!.progress ?? {}), ...(!e.setlistOnly ? catalog.find(s => s.id === e.songId)?.progress ?? {} : {}) } } }))
    : catalog.filter(s => !s.archived).map(song => ({ songId: song.id, song })));
  const visible = $derived(candidates.filter(item => `${item.song.artist} ${item.song.title}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort(compareRehearsalSongs));
  const names = $derived(orderMusicianNames([...new Set([
    ...musicians.filter(m => !m.guest).map(m => m.name), ...attendees, ...Object.keys(attendanceOverrides), ...guests,
    ...[...candidates, ...selected].flatMap(item => rehearsalCoverage(item.song, []).needed),
  ])], musicians));
  function needed(name: string) { return selected.filter(item => rehearsalCoverage(item.song, []).needed.includes(name)).length; }
  function isSelected(item: RehearsalSong) { return selected.some(s => s.songId === item.songId); }
  function toggle(item: RehearsalSong) { selected = isSelected(item) ? selected.filter(s => s.songId !== item.songId) : [...selected, item]; }
  function toggleAttendee(name: string) { attendanceOverrides = { ...attendanceOverrides, [name]: !attendees.includes(name) }; }
  function chooseMusicians(included: boolean) { attendanceOverrides = { ...attendanceOverrides, ...Object.fromEntries(names.map(name => [name, included])) }; }
  function addGuest() { const name = guest.trim(); if (!name) return; guests = [...new Set([...guests, name])]; attendanceOverrides = { ...attendanceOverrides, [name]: true }; guest = ''; }

</script>
<section class="selection-layout" aria-label={$rt.plan}>
  <aside>
    {@render details()}
    <fieldset class="musicians-panel" aria-label={$rt.attendees} {disabled}>
      <div class="attendees-header"><strong>{$rt.attendees}</strong><button type="button" onclick={() => chooseMusicians(true)}>{$rt.all}</button><button type="button" onclick={() => chooseMusicians(false)}>{$rt.none}</button></div>
      <div class="chips">
        {#each names as name}
          {@const count = needed(name)}
          <button type="button" class:active={attendees.includes(name)} class:needed={count > 0} class:unused={selected.length > 0 && count === 0} aria-pressed={attendees.includes(name)} title={count ? `${$rt.needed}: ${count}` : $rt.unused} onclick={() => toggleAttendee(name)}>{name} <span>{count}</span></button>
        {/each}
      </div>
      <div class="guest"><input bind:value={guest} placeholder={$rt.guest} aria-label={$rt.guest} maxlength="100" onkeydown={e => { if (e.key === 'Enter') { e.preventDefault(); addGuest(); } }} /><button type="button" onclick={addGuest}>{$rt.add}</button></div>
    <p class="hint">{$rt.attendanceAutoHint}</p>
    </fieldset>
  </aside>
  <fieldset class="songs-panel" aria-label={$rt.songSelectionTitle} {disabled}>
    <div class="songs-header">
      <h3>{$rt.songSelectionTitle}</h3>
      <div class="tabs">
        {#if setlist}<button type="button" class:active={source === 'setlist'} onclick={() => { source = 'setlist'; }} aria-pressed={source === 'setlist'}>{$rt.fromSetlist}</button>{/if}
        <button type="button" class:active={source === 'catalog' || (source === 'setlist' && !setlist)} onclick={() => { source = 'catalog'; }} aria-pressed={source === 'catalog' || (source === 'setlist' && !setlist)}>{$rt.catalog}</button>
        <button type="button" class="selected-count" class:active={source === 'selected'} aria-pressed={source === 'selected'} onclick={() => { source = 'selected'; }}>{selected.length} {$rt.selected}</button>
      </div>
    </div>
    <input class="search" bind:value={search} placeholder={$rt.search} aria-label={$rt.search} />
    <div class="songs">
      {#each visible as item (rehearsalSongKey(item))}
        {@const pct = rehearsalReadiness(item.song)}
        {@const coverage = rehearsalCoverage(item.song, attendees)}
        <label class="song" class:incomplete={!coverage.complete} class:chosen={isSelected(item)}>
          <input type="checkbox" checked={isSelected(item)} onchange={() => toggle(item)} />
          <span class="song-copy"><RehearsalSongName artist={item.song.artist} title={item.song.title} dimmed={!coverage.complete} /><small class:complete={coverage.complete}>{coverage.complete ? $rt.available : coverage.needed.length ? `${$rt.missing}: ${coverage.missing.join(', ')}` : $rt.unassigned}</small></span>
          <RehearsalReadiness value={pct} label={$rt.fullReadiness} />
        </label>
      {:else}<p>{$rt.noMatches}</p>{/each}
    </div>
  </fieldset>
</section>
<style>
  .selection-layout { height: 100%; min-height: 0; display: grid; grid-template-columns: minmax(240px, .75fr) minmax(0, 1.6fr); gap: 24px; }
  aside { min-height: 0; overflow-y: auto; padding: 2px 4px 8px 2px; display: flex; flex-direction: column; gap: 22px; }
  fieldset { border: 0; padding: 0; margin: 0; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
  .songs-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .songs-panel { min-height: 0; overflow: hidden; }
  .songs-panel > :not(.songs) { flex-shrink: 0; }
  .chips { padding: 2px; }

  h3 { font-size: 1rem; margin: 0; }
  .hint { margin: 0; color: var(--text-muted); font-size: .8rem; line-height: 1.5; }
  button, input { font: inherit; }
  button { border: 1px solid var(--border); border-radius: 7px; padding: 8px 12px; background: var(--bg); color: var(--text); cursor: pointer; }
  button:disabled, input:disabled { opacity: .5; cursor: default; }
  .active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .attendees-header, .chips, .guest, .tabs { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .selected-count { box-sizing: border-box; width: 9rem; flex: 0 0 9rem; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .attendees-header strong { margin-right: auto; font-size: .9rem; }
  .attendees-header button { font-size: .78rem; }
  .chips button { font-size: .85rem; }
  .chips span { display: inline-block; min-width: calc(2ch + 1px); margin-left: 4px; font-size: .75rem; font-variant-numeric: tabular-nums; text-align: right; }
  .needed { box-shadow: 0 0 0 2px var(--accent); }
  .unused { opacity: .65; }
  .guest { flex-wrap: nowrap; }
  input:not([type=checkbox]) { box-sizing: border-box; min-width: 0; width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 7px; background: var(--bg); color: var(--text); }
  .songs { flex: 1; overflow-y: auto; min-height: 0; overscroll-behavior: contain; }
  .song { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 7px 8px; min-height: 44px; box-sizing: border-box; border-bottom: 1px solid var(--border); cursor: pointer; }
  .song input { width: 18px; height: 18px; flex-shrink: 0; accent-color: var(--accent); }
  .song-copy { min-width: 0; overflow-wrap: anywhere; }
  small { display: block; color: var(--text-muted); margin-top: 3px; font-size: .75rem; }
  .song:not(.chosen):hover { background: var(--row-hover); }
  .chosen { background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
  .complete { color: var(--accent); }
  @media(max-width: 700px), (max-height: 550px) {
    .selection-layout { height: auto; display: flex; flex-direction: column; }
    aside { overflow: visible; flex-shrink: 0; }
    .songs-panel { overflow: visible; flex-shrink: 0; }
    .songs { flex: none; max-height: 50dvh; min-height: 150px; }
  }
  @media(max-width: 600px) { input:not([type=checkbox]) { font-size: 16px; } }
</style>
