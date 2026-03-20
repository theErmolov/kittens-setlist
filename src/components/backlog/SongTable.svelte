<script lang="ts">
  import type { Song, Setlist, Category, Instrument } from '$lib/types';
  import SongRow from './SongRow.svelte';
  import SongEditModal from './SongEditModal.svelte';
  import FilterChips from '$components/shared/FilterChips.svelte';
  import { updateSong, deleteSong, addSongsToSetlist } from '$lib/api';
  import { musiciansStore } from '$lib/stores/musicians';
  import { t } from '$lib/i18n';

  let {
    songs,
    setlists,
    onadd
  }: {
    songs: Song[];
    setlists: Setlist[];
    onadd: () => void;
  } = $props();

  let search = $state('');
  let categoryFilter = $state(new Set<Category>());
  let selectedMusicians = $state(new Set<string>());
  let selectedInstruments = $state(new Set<Instrument>());
  let vocalsFilter = $state(false);
  let editingSong = $state<Song | null>(null);
  let addToSetlistSong = $state<Song | null>(null);
  let sortCol = $state<'artist' | 'title' | null>(null);
  let sortDir = $state<1 | -1>(1);

  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', percussion: '🪘', violin: '🎻'
  };
  const allInstruments: Instrument[] = ['guitar', 'bass', 'drums', 'keys', 'percussion', 'violin'];

  // Musician columns follow the roster order; all roster members always shown
  let allMusicians = $derived(() => $musiciansStore.map(m => m.name));

  function toggleSort(col: 'artist' | 'title') {
    if (sortCol === col) sortDir = sortDir === 1 ? -1 : 1;
    else { sortCol = col; sortDir = 1; }
  }

  let filtered = $derived(() => {
    const f = songs.filter(s => {
    const q = search.toLowerCase();
    if (q && !s.artist.toLowerCase().includes(q) && !s.title.toLowerCase().includes(q)) return false;
    if (categoryFilter.size > 0 && !categoryFilter.has(s.category)) return false;
    // AND: every selected musician must appear in the song
    for (const m of selectedMusicians) {
      if (!(m in s.musicians)) return false;
    }
    if (selectedInstruments.size > 0) {
      if (selectedMusicians.size > 0) {
        // instrument filter scoped to selected musicians:
        // at least one selected musician plays one of the selected instruments
        const match = [...selectedMusicians].some(m => {
          const role = s.musicians[m];
          return role && role.instrument != null && selectedInstruments.has(role.instrument);
        });
        if (!match) return false;
      } else {
        // no musician selected — any musician playing one of the instruments
        if (!Object.values(s.musicians).some(r => r.instrument != null && selectedInstruments.has(r.instrument))) return false;
      }
    }
    if (vocalsFilter) {
      if (selectedMusicians.size > 0) {
        if (![...selectedMusicians].some(m => s.musicians[m]?.vocals)) return false;
      } else {
        if (!Object.values(s.musicians).some(r => r.vocals)) return false;
      }
    }
    return true;
    });
    if (!sortCol) return f;
    return [...f].sort((a, b) => a[sortCol!].localeCompare(b[sortCol!], undefined, { sensitivity: 'base' }) * sortDir);
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
    editingSong = null;
  }

  async function handleDelete(id: string) {
    if (!confirm($t.deleteConfirm)) return;
    await deleteSong(id);
  }

  async function handleAddToSetlist(setlistId: string) {
    if (!addToSetlistSong) return;
    await addSongsToSetlist(setlistId, [addToSetlistSong.id]);
    addToSetlistSong = null;
  }
</script>

<div class="table-container">
  <div class="toolbar">
    <input class="search" placeholder={$t.backlog.search} bind:value={search} />
    <FilterChips selected={categoryFilter} onchange={v => { categoryFilter = v; }} />
    <span class="song-count">{$t.backlog.shown(filtered().length, songs.length)}</span>
    <button class="add-btn" onclick={onadd}>{$t.backlog.addSong}</button>
  </div>

  <div class="filter-bar">
    <div class="filter-group">
      {#each allMusicians() as name}
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
      <button
        class="filter-chip filter-chip-inst"
        class:active={vocalsFilter}
        onclick={() => { vocalsFilter = !vocalsFilter; }}
        title="Vocals"
      >🎤</button>
    </div>
  </div>

  <div class="scroll-wrap">
    <table>
      <thead>
        <tr>
          <th class="th-sortable" onclick={() => toggleSort('artist')}>
            {$t.backlog.cols.artist}{sortCol === 'artist' ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
          </th>
          <th class="th-sortable" onclick={() => toggleSort('title')}>
            {$t.backlog.cols.title}{sortCol === 'title' ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
          </th>
          <th>{$t.backlog.cols.cat}</th>
          <th>{$t.backlog.cols.comment}</th>
          {#each allMusicians() as name, i}
            <th class="th-musician" class:musician-alt={i % 2 === 1}>{name}</th>
          {/each}
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each filtered() as song (song.id)}
          <SongRow
            {song}
            allMusicians={allMusicians()}
            onedit={() => { editingSong = song; }}
            ondelete={() => handleDelete(song.id)}
            onaddtosetlist={() => { addToSetlistSong = song; }}
          />
        {/each}
        {#if filtered().length === 0}
          <tr><td colspan={5 + allMusicians().length} class="empty">{$t.backlog.empty}</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>

{#if editingSong}
  <SongEditModal
    song={editingSong}
    onclose={() => { editingSong = null; }}
    onsave={handleSave}
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
        {#if setlists.length === 0}
          <p class="empty">{$t.addToSetlist.noSetlists} <a href="/setlists">{$t.addToSetlist.createLink}</a></p>
        {:else}
          {#each setlists as sl}
            <button class="setlist-option" onclick={() => handleAddToSetlist(sl.id)}>
              <span class="sl-name">{sl.name}</span>
              {#if sl.date}<span class="sl-date">{sl.date}</span>{/if}
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

  .scroll-wrap { overflow-x: auto; overflow-y: auto; flex: 1; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; }
  thead tr { background: var(--surface); }
  th { position: sticky; top: 0; z-index: 1; background: var(--surface); }
  th {
    text-align: left; padding: 8px 12px; font-size: 0.75rem; font-weight: 700;
    color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;
    white-space: nowrap; border-bottom: 1px solid var(--border);
  }
  .th-musician { text-align: left; }
  .musician-alt { background: var(--musician-alt-bg); }
  .th-sortable { cursor: pointer; user-select: none; }
  .th-sortable:hover { color: var(--accent); }
  .empty { text-align: center; padding: 40px; color: var(--text-muted); }

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
    background: transparent; cursor: pointer; text-align: left; width: 100%; transition: background 0.12s;
  }
  .setlist-option:hover { background: var(--row-hover); }
  .sl-name { font-weight: 500; font-size: 0.9rem; }
  .sl-date { font-size: 0.78rem; color: var(--text-muted); }
</style>
