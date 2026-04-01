<script lang="ts">
  import type { Song, Setlist, Category, Instrument, BandMusician } from '$lib/types';
  import SongRow from './SongRow.svelte';
  import SongEditModal from './SongEditModal.svelte';
  import FilterChips from '$components/shared/FilterChips.svelte';
  import { updateSong, deleteSong, addSongsToSetlist, removeSongFromSetlist } from '$lib/api';
  import { formatDuration } from '$lib/utils';
  import { t } from '$lib/i18n';

  let {
    songs: songsProp,
    setlists,
    musicians,
    loading = false,
    onadd
  }: {
    songs: Song[];
    setlists: Setlist[];
    musicians: BandMusician[];
    loading?: boolean;
    onadd: () => void;
  } = $props();

  let songs = $state(songsProp);
  $effect(() => { songs = songsProp; });

  let localSetlists = $state(setlists);
  $effect(() => { localSetlists = setlists; });

  let search = $state('');
  let categoryFilter = $state(new Set<Category>());
  let selectedMusicians = $state(new Set<string>());
  let selectedInstruments = $state(new Set<Instrument>());
  let showProgress = $state(false);
  let editingSong = $state<Song | null>(null);
  let addToSetlistSong = $state<Song | null>(null);
  let sortCol = $state<'artist' | 'title'>('artist');
  let sortDir = $state<1 | -1>(1);

  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', percussion: '🪇', vocals: '🎤'
  };
  const allInstruments: Instrument[] = ['vocals', 'guitar', 'bass', 'keys', 'violin', 'drums', 'cajon', 'percussion'];

  // Column names — all registered musicians (guests are ad-hoc in song.musicians, not in roster)
  let permanentNames = $derived(musicians.map(m => m.name));
  // Per-musician column width so all columns sum to 100%
  // Fixed: cat 9% + artist 18% + title 28% + actions 9% = 64% → musicians get 36%, capped at 5%
  let musicianColPct = $derived(Math.min(5, Math.floor(36 / (permanentNames.length || 1))));

  function toggleSort(col: 'artist' | 'title') {
    if (sortCol === col) sortDir = (sortDir === 1 ? -1 : 1);
    else { sortCol = col; sortDir = 1; }
  }

  let filtered = $derived(() => {
    const f = songs.filter(s => {
    const q = search.toLowerCase();
    if (q && !s.artist.toLowerCase().includes(q) && !s.title.toLowerCase().includes(q)) return false;
    if (categoryFilter.size > 0 && !categoryFilter.has(s.category)) return false;
    // AND: every selected musician must actively participate (has an instrument)
    for (const m of selectedMusicians) {
      const role = s.musicians[m];
      if (!role || role.instruments.length === 0) return false;
    }
    if (selectedInstruments.size > 0) {
      if (selectedMusicians.size > 0) {
        // instrument filter scoped to selected musicians:
        // at least one selected musician plays one of the selected instruments
        const match = [...selectedMusicians].some(m => {
          const role = s.musicians[m];
          return role && role.instruments.some(i => selectedInstruments.has(i));
        });
        if (!match) return false;
      } else {
        // no musician selected — any musician playing one of the instruments
        if (!Object.values(s.musicians).some(r => r.instruments.some(i => selectedInstruments.has(i)))) return false;
      }
    }
    return true;
    });
    return [...f].sort((a, b) => a[sortCol].localeCompare(b[sortCol], undefined, { sensitivity: 'base' }) * sortDir);
  });

  function toggleMusician(name: string) {
    const next = new Set(selectedMusicians);
    next.has(name) ? next.delete(name) : next.add(name);
    selectedMusicians = next;
  }

  function toggleInstrument(inst: Instrument) {
    const next = new Set(selectedInstruments);
    next.has(inst) ? next.delete(inst) : next.add(inst);
    selectedInstruments = next;
  }

  async function handleSave(updated: Song) {
    await updateSong(updated);
    songs = songs.map(s => s.id === updated.id ? updated : s);
    editingSong = null;
  }

  async function handleDelete(id: string) {
    if (!confirm($t.deleteConfirm)) return;
    await deleteSong(id);
    songs = songs.filter(s => s.id !== id);
  }

  async function handleToggleSetlist(sl: Setlist) {
    if (!addToSetlistSong) return;
    const song = addToSetlistSong;
    const inSetlist = sl.entries.some(e => e.songId === song.id);
    const updated = inSetlist
      ? await removeSongFromSetlist(sl.id, song.id)
      : await addSongsToSetlist(sl.id, [song]);
    localSetlists = localSetlists.map(s => s.id === sl.id ? updated : s);
  }
</script>

<div class="table-container">
  <div class="toolbar">
    <input class="search" placeholder={$t.backlog.search} bind:value={search} />
    <div class="chips-row">
      <FilterChips selected={categoryFilter} onchange={v => { categoryFilter = v; }} />
      <span class="song-count">{$t.backlog.shown(filtered().length, songs.length)} ({formatDuration(filtered().length * 5)})</span>
    </div>
    <button class="add-btn" onclick={onadd}>{$t.backlog.addSong}</button>
  </div>

  <div class="filter-bar">
    <div class="filter-group">
      {#each permanentNames as name}
        <button
          class="filter-chip"
          class:active={selectedMusicians.has(name)}
          onclick={() => toggleMusician(name)}
        >{name}</button>
      {/each}
    </div>
    <div class="filter-sep"></div>
    <div class="filter-group">
      {#each allInstruments as inst}
        <button
          class="filter-chip filter-chip-inst"
          class:active={selectedInstruments.has(inst)}
          onclick={() => toggleInstrument(inst)}
          title={$t.instrument[inst]}
        >{instrumentIcons[inst]}</button>
      {/each}
    </div>
    <button
      class="filter-chip progress-toggle"
      class:active={showProgress}
      onclick={() => { showProgress = !showProgress; }}
    ><span class="progress-icon">📊</span><span class="progress-label">{$t.backlog.progress}</span></button>
  </div>

  <div class="scroll-wrap">
    <table>
      <colgroup>
        <col style="width: 5%">
        <col style="width: 18%">
        <col style="width: 28%">
        {#each permanentNames as _}
          <col style="width: {musicianColPct}%">
        {/each}
        <col style="width: 9%">
      </colgroup>
      <thead>
        <tr>
          <th class="th-cat">{showProgress ? $t.backlog.progress : $t.backlog.cols.cat}</th>
          <th class="th-sortable th-artist" onclick={() => toggleSort('artist')}>
            {$t.backlog.cols.artist}{sortCol === 'artist' ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
          </th>
          <th class="th-sortable" onclick={() => toggleSort('title')}>
            {$t.backlog.cols.title}{sortCol === 'title' ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
          </th>
          {#each permanentNames as name, i}
            <th class="th-musician" class:musician-alt={i % 2 === 0}>{name}</th>
          {/each}
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each filtered() as song (song.id)}
          <SongRow
            {song}
            allMusicians={permanentNames}
            {showProgress}
            onedit={() => { editingSong = song; }}
            ondelete={() => handleDelete(song.id)}
            onaddtosetlist={() => { addToSetlistSong = song; }}
          />
        {/each}
        {#if loading}
          <tr><td colspan={4 + permanentNames.length} class="empty">…</td></tr>
        {:else if filtered().length === 0}
          <tr><td colspan={4 + permanentNames.length} class="empty">{$t.backlog.empty}</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>

{#if editingSong}
  <SongEditModal
    song={editingSong}
    {musicians}
    onclose={() => { editingSong = null; }}
    onsave={handleSave}
    ondelete={async () => {
      const id = editingSong!.id;
      await deleteSong(id);
      songs = songs.filter(s => s.id !== id);
    }}
    onaddtosetlist={() => { addToSetlistSong = editingSong; }}
  />
{/if}

{#if addToSetlistSong}
  <div class="modal-backdrop" onclick={e => { if ((e.target as HTMLElement).classList.contains('modal-backdrop')) addToSetlistSong = null; }} role="dialog" aria-modal="true">
    <div class="picker-modal">
      <div class="modal-header">
        <h3>{$t.addToSetlist.title}</h3>
        <button class="close-btn" onclick={() => { addToSetlistSong = null; }}>✕</button>
      </div>
      <div class="modal-body">
        <p class="song-name">"{addToSetlistSong.artist} – {addToSetlistSong.title}"</p>
        {#if localSetlists.length === 0}
          <p class="empty">{$t.addToSetlist.noSetlists} <a href="/setlists">{$t.addToSetlist.createLink}</a></p>
        {:else}
          {#each localSetlists as sl}
            {@const inSetlist = sl.entries.some(e => e.songId === addToSetlistSong!.id)}
            <button class="setlist-option" class:in-setlist={inSetlist} onclick={() => handleToggleSetlist(sl)}>
              <span class="sl-name">{sl.name}</span>
              <span class="sl-right">
                {#if sl.date}<span class="sl-date">{sl.date}</span>{/if}
                {#if inSetlist}<span class="sl-check">✓</span>{/if}
              </span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .table-container { display: flex; flex-direction: column; height: calc(100dvh - 72px); }

  .toolbar {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 16px; border-bottom: 1px solid var(--border); flex-wrap: wrap;
  }
  .search {
    padding: 7px 12px; border: 1px solid var(--border); border-radius: 6px;
    background: var(--bg); color: var(--text); font-size: 0.88rem; min-width: 200px;
    touch-action: manipulation;
  }
  .song-count { font-size: 0.82rem; color: var(--text-muted); white-space: nowrap; }
  .add-btn {
    margin-left: auto; padding: 7px 16px;
    background: var(--accent); color: #fff; border: none; border-radius: 6px;
    cursor: pointer; font-weight: 600; font-size: 0.88rem;
  }

  .filter-bar {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 8px 16px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
    gap: 8px;
  }
  .filter-group { display: flex; gap: 5px; flex-wrap: wrap; }
  .filter-sep {
    width: 1px; height: 22px; background: var(--border); flex-shrink: 0; align-self: center;
  }
  .filter-chip {
    padding: 3px 12px;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: transparent;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--text-muted);
    transition: all 0.15s;
  }
  .filter-chip:hover { border-color: var(--accent); color: var(--accent); }
  .filter-chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .filter-chip-inst { padding: 3px 9px; font-size: 0.95rem; }
  .progress-toggle { margin-left: auto; }

  .scroll-wrap { overflow-x: auto; overflow-y: auto; flex: 1; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
  thead tr { background: var(--surface); }
  th { position: sticky; top: 0; z-index: 1; background: var(--surface); }
  th {
    text-align: left; padding: 8px 12px; font-size: 0.75rem; font-weight: 700;
    color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;
    white-space: nowrap; border-bottom: 1px solid var(--border); overflow: hidden;
  }
  .th-cat { text-align: center; }
  .th-musician { text-align: left; padding-left: 12px; }
  .musician-alt { background: var(--musician-alt-bg); }
  .th-sortable { cursor: pointer; user-select: none; }
  .th-sortable:hover { color: var(--accent); }
  .empty { text-align: center; padding: 40px; color: var(--text-muted); }

  .chips-row { display: flex; align-items: center; gap: 8px; }
  .chips-row .song-count { flex-shrink: 0; }

  @media (max-width: 700px) {
    /* Toolbar:
       line 1: [search ···············] [+ Add]
       line 2: [category chips] [count right-aligned] */
    .toolbar { gap: 6px 8px; padding: 8px 12px; }
    .search { order: 1; flex: 1; min-width: 0; font-size: 16px; }
    .add-btn { order: 2; margin-left: 0; flex-shrink: 0; }
    .chips-row { order: 3; width: 100%; }
    .chips-row .song-count { margin-left: auto; }
    /* Filter-bar: progress label hidden, only icon shown */
    .progress-label { display: none; }
    /* Table → card list */
    thead { display: none; }
    table { display: block; }
    tbody { display: block; }
    .scroll-wrap { overflow-x: hidden; }
  }

  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px;
  }
  .picker-modal { background: var(--surface); border-radius: 12px; width: 100%; max-width: 360px; overflow: hidden; }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border); }
  .modal-header h3 { margin: 0; font-size: 1rem; }
  .close-btn { background: none; border: none; cursor: pointer; color: var(--text-muted); }
  .modal-body { padding: 12px 18px; display: flex; flex-direction: column; gap: 6px; }
  .song-name { font-size: 0.85rem; color: var(--text-muted); margin: 0 0 8px; }
  .setlist-option {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px;
    background: transparent; cursor: pointer; text-align: left; width: 100%; transition: background 0.12s, border-color 0.12s;
  }
  .setlist-option:hover { background: var(--row-hover); }
  .setlist-option.in-setlist { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
  .setlist-option.in-setlist:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .sl-name { font-weight: 500; font-size: 0.9rem; }
  .sl-right { display: flex; align-items: center; gap: 8px; }
  .sl-date { font-size: 0.78rem; color: var(--text-muted); }
  .sl-check { font-size: 0.9rem; color: var(--accent); font-weight: 700; }
</style>
