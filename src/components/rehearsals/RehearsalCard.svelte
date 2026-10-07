<script lang="ts">
  import { base } from '$app/paths';
  import { lang } from '$lib/i18n';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { formatDate } from '$lib/utils';
  import type { Rehearsal } from '$lib/types';
  let { rehearsal, setlistName }: { rehearsal: Rehearsal; setlistName?: string } = $props();
</script>
<a class="card" class:cancelled={rehearsal.cancelled} href="{base}/rehearsals/{rehearsal.id}">
  <div class="date">{formatDate(rehearsal.date, $lang)} <span>{rehearsal.startTime}{rehearsal.endTime ? `–${rehearsal.endTime}` : ''}</span></div>
  {#if rehearsal.cancelled}<strong class="status">{$rt.cancelled}</strong>{/if}
  {#if rehearsal.location}<div class="location">{rehearsal.location}</div>{/if}
  {#if setlistName}<div class="setlist">{setlistName}</div>{/if}
  <div class="people">{rehearsal.attendees.join(' · ') || '—'}</div>
  <div class="count">{$rt.songs}: {rehearsal.songs.length}</div>
</a>
<style>
  .card { display: flex; flex-direction: column; gap: 9px; text-decoration: none; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: 13px; padding: 17px; transition: border-color .15s; }
  .card:hover { border-color: var(--accent); }
  .date { font-weight: 650; font-size: .95rem; } .date span { display: block; margin-top: 4px; color: var(--accent); font-size: 1.15rem; }
  .people, .count, .setlist { font-size: .8rem; color: var(--text-muted); overflow-wrap: anywhere; }
  .location { font-size: .9rem; overflow-wrap: anywhere; }
  .cancelled { opacity: .65; } .status { font-size: .8rem; color: var(--text-muted); }
</style>
