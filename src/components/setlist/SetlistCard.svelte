<script lang="ts">
  import type { Setlist } from '$lib/types';
  import { t } from '$lib/i18n';
  import { formatDuration } from '$lib/utils';
  import { base } from '$app/paths';

  let { setlist, ondelete }: { setlist: Setlist; ondelete: () => void } = $props();

  let songCount = $derived(setlist.entries.filter(e => e.songId).length);
  let breakMins = $derived(setlist.entries.reduce((s, e) => s + (e.breakMinutes ?? 0), 0));

</script>

<div class="card">
  <a href="{base}/setlists/{setlist.id}" class="card-link">
    <div class="card-name">{setlist.name}</div>
    <div class="card-meta">
      {#if setlist.date}<span class="date">{setlist.date}</span>{/if}
      <span class="count">{$t.setlists.songs(songCount)} ({formatDuration(songCount * 5 + breakMins)})</span>
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
  .card-meta { display: flex; gap: 12px; }
  .date, .count { font-size: 0.82rem; color: var(--text-muted); }
  .card-actions { display: flex; align-items: center; gap: 8px; }
  .stage-link { padding: 6px 12px; background: var(--accent); color: #fff; border-radius: 6px; text-decoration: none; font-size: 0.82rem; font-weight: 600; }
  .delete-btn { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 0.9rem; padding: 4px 6px; border-radius: 4px; }
  .delete-btn:hover { color: #ef4444; }
</style>
