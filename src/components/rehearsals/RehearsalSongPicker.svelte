<script lang="ts">
  import { untrack } from 'svelte';
  import { modalDialog } from '$lib/modalDialog';
  import type { Rehearsal, RehearsalSong, Song, Setlist } from '$lib/types';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { rehearsalReadiness, rehearsalSongKey } from '$lib/rehearsals';
  let { rehearsal, setlist, catalog, onsave, onclose }: {
    rehearsal: Rehearsal; setlist?: Setlist; catalog: Song[];
    onsave: (songs: RehearsalSong[]) => Promise<void>; onclose: () => void;
  } = $props();
  let source = $state(untrack(() => setlist ? 'setlist' : 'catalog'));
  let search = $state('');
  let selected = $state<RehearsalSong[]>(untrack(() => [...rehearsal.songs]));
  let busy = $state(false), error = $state('');
  const candidates = $derived(source === 'setlist' && setlist
    ? [...setlist.entries].sort((a,b) => a.order - b.order).filter(e => e.song && e.songId).map(e => ({ songId: e.songId!, sourceSetlistId: setlist.id, song: { ...e.song!, progress: { ...(e.progress ?? {}), ...(e.song!.progress ?? {}), ...(!e.setlistOnly ? catalog.find(s => s.id === e.songId)?.progress ?? {} : {}) } } }))
    : catalog.filter(s => !s.archived).map(song => ({ songId: song.id, song })));
  const visible = $derived(candidates.filter(item => `${item.song.artist} ${item.song.title}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  function isSelected(item: RehearsalSong) { return selected.some(s => s.songId === item.songId); }
  function toggle(item: RehearsalSong) { selected = isSelected(item) ? selected.filter(s => s.songId !== item.songId) : [...selected, item]; }
  function selectMany(items: RehearsalSong[]) { for (const item of items) if (!isSelected(item)) selected = [...selected, item]; }
  async function save() {
    busy = true; error = '';
    try { await onsave(selected); } catch(e) { error = String(e).includes('409') ? $rt.conflict : $rt.saveError; }
    finally { busy = false; }
  }
</script>
<div class="overlay">
  <dialog class="modal" aria-labelledby="song-picker-title" use:modalDialog={() => { if (!busy) onclose(); }}>
    <h2 id="song-picker-title">{$rt.addSongs}</h2>
    <fieldset disabled={busy}>
      <div class="tabs">
        {#if setlist}<button class:active={source === 'setlist'} onclick={() => { source = 'setlist'; }} aria-pressed={source === 'setlist'}>{$rt.fromSetlist}</button>{/if}
        <button class:active={source === 'catalog'} onclick={() => { source = 'catalog'; }} aria-pressed={source === 'catalog'}>{$rt.catalog}</button>
      </div>
      <input bind:value={search} placeholder={$rt.search} aria-label={$rt.search} />
      <div class="shortcuts"><button onclick={() => selectMany(visible)}>{$rt.all}</button><button onclick={() => selectMany(visible.filter(s => { const pct = rehearsalReadiness(s.song, rehearsal.attendees); return pct !== null && pct < 100; }))}>{$rt.notReady}</button></div>
      <div class="songs">
        {#each visible as item (rehearsalSongKey(item))}
          {@const pct = rehearsalReadiness(item.song, rehearsal.attendees)}
          <label class="song"><input type="checkbox" checked={isSelected(item)} onchange={() => toggle(item)} /><span><strong>{item.song.title}</strong><small>{item.song.artist}</small></span><span class="pct" title={$rt.sessionReadiness}>{pct === null ? '—' : `${pct}%`}</span></label>
        {:else}<p>{$rt.noMatches}</p>{/each}
      </div>
    </fieldset>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <footer><span>{selected.length} {$rt.selected}</span><button onclick={onclose} disabled={busy}>{$rt.cancel}</button><button class="primary" onclick={save} disabled={busy}>{busy ? $rt.pending : $rt.save}</button></footer>
  </dialog>
</div>
<style>
  .overlay { position: fixed; inset: 0; z-index: 150; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .modal { width: min(600px, 100%); max-height: 90dvh; display: flex; flex-direction: column; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px; }
  .modal::backdrop { background: #0008; }
  h2 { font-size: 1.15rem; margin: 0 0 16px; } fieldset { border: 0; padding: 0; margin: 0; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
  button { border: 1px solid var(--border); border-radius: 7px; padding: 8px 12px; background: var(--bg); color: var(--text); cursor: pointer; } button:disabled { opacity: .5; cursor: default; }
  .tabs, .shortcuts { display: flex; gap: 8px; } .active, .primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  input:not([type=checkbox]) { padding: 10px; border: 1px solid var(--border); border-radius: 7px; background: var(--bg); color: var(--text); font: inherit; }
  .songs { overflow-y: auto; min-height: 100px; max-height: 48dvh; } .song { display: flex; align-items: center; gap: 12px; padding: 12px 4px; border-bottom: 1px solid var(--border); cursor: pointer; }
  .song input { width: 18px; height: 18px; accent-color: var(--accent); } .song strong { font-size: .9rem; } small { display: block; color: var(--text-muted); margin-top: 3px; } .pct { margin-left: auto; font-size: .85rem; color: var(--text-muted); }
  footer { display: flex; gap: 8px; align-items: center; margin-top: 18px; font-size: .8rem; } footer span { margin-right: auto; color: var(--text-muted); } .error { color: #dc2626; font-size: .85rem; }
  @media(max-width: 600px) { input:not([type=checkbox]) { font-size: 16px; } .modal { padding: 16px; } }
</style>
