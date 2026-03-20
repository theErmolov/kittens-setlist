<script lang="ts">
  import type { Song, Category } from '$lib/types';
  import FilterChips from '$components/shared/FilterChips.svelte';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import { t } from '$lib/i18n';

  let {
    songs,
    existingIds,
    onclose,
    onadd
  }: {
    songs: Song[];
    existingIds: Set<string>;
    onclose: () => void;
    onadd: (ids: string[]) => void;
  } = $props();

  let search = $state('');
  let categoryFilter = $state(new Set<Category>());
  let selected = $state(new Set<string>());

  let filtered = $derived(songs
    .filter(s => {
      if (existingIds.has(s.id)) return false;
      if (categoryFilter.size > 0 && !categoryFilter.has(s.category)) return false;
      const q = search.toLowerCase();
      return !q || s.artist.toLowerCase().includes(q) || s.title.toLowerCase().includes(q);
    })
    .sort((a, b) => a.artist.localeCompare(b.artist, undefined, { sensitivity: 'base' })));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    selected = next;
  }

  function handleAdd() { onadd([...selected]); }

  function handleBackdrop(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) onclose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={handleBackdrop}>
  <div class="modal">
    <div class="modal-header">
      <h2>{$t.addSongs.title}</h2>
      <button class="close-btn" onclick={onclose}>✕</button>
    </div>
    <div class="search-bar">
      <input bind:value={search} placeholder={$t.addSongs.search} />
    </div>
    <div class="filter-bar">
      <FilterChips selected={categoryFilter} onchange={v => { categoryFilter = v; }} />
    </div>
    <div class="song-list">
      {#each filtered as song (song.id)}
        <label class="song-item" class:selected={selected.has(song.id)}>
          <input type="checkbox" checked={selected.has(song.id)} onchange={() => toggle(song.id)} />
          <span class="song-info">
            <CategoryBadge category={song.category} iconOnly />
            <span class="song-title">{song.artist} – {song.title}</span>
          </span>
        </label>
      {/each}
      {#if filtered.length === 0}
        <p class="empty">{$t.addSongs.empty}</p>
      {/if}
    </div>
    <div class="modal-footer">
      <span class="sel-count">{$t.addSongs.selected(selected.size)}</span>
      <button class="btn-secondary" onclick={onclose}>{$t.addSongs.cancel}</button>
      <button class="btn-primary" onclick={handleAdd} disabled={selected.size === 0}>
        {$t.addSongs.addBtn(selected.size)}
      </button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
  .modal { background: var(--surface); border-radius: 12px; width: 100%; max-width: 480px; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .modal-header h2 { margin: 0; font-size: 1.05rem; }
  .close-btn { background: none; border: none; cursor: pointer; color: var(--text-muted); }
  .search-bar { padding: 10px 18px; flex-shrink: 0; border-bottom: 1px solid var(--border); }
  .search-bar input { width: 100%; padding: 7px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-size: 0.88rem; box-sizing: border-box; }
  .filter-bar { padding: 8px 18px; flex-shrink: 0; border-bottom: 1px solid var(--border); }
  .song-list { flex: 1; overflow-y: auto; padding: 8px 0; }
  .song-item { display: flex; align-items: center; gap: 10px; padding: 9px 18px; cursor: pointer; transition: background 0.12s; }
  .song-item:hover, .song-item.selected { background: var(--row-hover); }
  .song-info { display: flex; align-items: center; gap: 6px; flex: 1; }
.song-title { font-size: 0.88rem; }
  .empty { text-align: center; color: var(--text-muted); padding: 24px; }
  .modal-footer { display: flex; align-items: center; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .sel-count { flex: 1; font-size: 0.82rem; color: var(--text-muted); }
  .btn-primary { padding: 8px 18px; background: var(--accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
  .btn-primary:disabled { opacity: 0.4; cursor: default; }
  .btn-secondary { padding: 8px 18px; background: transparent; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; color: var(--text); }
</style>
