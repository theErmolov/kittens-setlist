<script lang="ts">
  import Note from '$components/shared/Note.svelte';
  import type { Setlist } from '$lib/types';
  import { lang, t } from '$lib/i18n';
  import { formatDuration, formatDate } from '$lib/utils';
  import { base } from '$app/paths';

  let { setlist, ondelete }: { setlist: Setlist; ondelete: () => void } = $props();

  let songCount = $derived(setlist.entries.filter(e => e.songId).length);
  let breakMins = $derived(setlist.entries.reduce((s, e) => s + (e.breakMinutes ?? 0), 0));
  let songMins = $derived(setlist.entries.filter(e => e.songId).reduce((s, e) => s + (e.song?.lengthMinutes ?? 5), 0));

</script>

<div class="card">
  <a href="{base}/setlists/{setlist.id}" class="card-link">
    <div class="card-name">{setlist.name}</div>
    <Note value={setlist.comment} label={$t.common.setlistComment} preview />
    <div class="card-meta">
      {#if setlist.date}<span class="date">{formatDate(setlist.date, $lang)}</span>{/if}
      {#if setlist.startTime}<span class="date">⏱ {setlist.startTime}</span>{/if}
      <span class="count">{$t.setlists.songs(songCount)} ({formatDuration(songMins + breakMins, $lang)})</span>
      <span class="vibe-chip" class:no-vibe={!setlist.vibe}>{setlist.vibe ? $t.setlists.vibeOn : $t.setlists.vibeOff}</span>
    </div>
  </a>
  <div class="card-actions">
    <a href="{base}/setlists/{setlist.id}/stage" class="stage-link">{$t.setlists.stage}</a>
    <button class="delete-btn" onclick={ondelete} title={$t.song.remove}>🗑</button>
  </div>
</div>

<style>
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px; display: flex; align-items: center; gap: 12px; transition: border-color 0.15s; }
  .card:hover { border-color: var(--accent); }
  .card-link { flex: 1; text-decoration: none; color: inherit; }
  .card-name { font-weight: 600; font-size: 1rem; margin-bottom: 4px; }
  .card-meta { display: flex; gap: 12px; align-items: center; }
  .date, .count { font-size: 0.82rem; color: var(--text-muted); }
  .vibe-chip {
    display: inline-flex; align-items: center; line-height: 1;
    font-size: 0.72rem; font-weight: 600; padding: 3px 7px; border-radius: 10px;
    background: #ede9fe; color: #7c3aed;
  }
  .vibe-chip.no-vibe { background: #fee2e2; color: #dc2626; }
  .card-actions { display: flex; align-items: center; gap: 8px; }
  .stage-link { padding: 12px 12px; background: var(--accent); color: #fff; border-radius: 6px; text-decoration: none; font-size: 0.82rem; font-weight: 600; }
  .delete-btn { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 0.9rem; padding: 4px 6px; border-radius: 4px; }
  .delete-btn:hover { color: #ef4444; }
</style>
