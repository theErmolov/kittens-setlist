<script lang="ts">
  import { base } from '$app/paths';
  import { canAccessRehearsals } from '$lib/auth';
  import { getRehearsals } from '$lib/api';
  import { lang } from '$lib/i18n';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { formatDate } from '$lib/utils';
  import { isUpcoming } from '$lib/rehearsals';
  import type { Rehearsal } from '$lib/types';
  let { setlistId }: { setlistId: string } = $props();
  let rehearsals = $state<Rehearsal[]>([]);
  let error = $state(false);
  $effect(() => {
    if (!$canAccessRehearsals) return;
    const id = setlistId;
    let active = true;
    rehearsals = []; error = false;
    getRehearsals().then(items => { if (active) rehearsals = items.filter(r => r.setlistId === id && isUpcoming(r)).sort((a,b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)); }).catch(() => { if (active) error = true; });
    return () => { active = false; };
  });
</script>
{#if $canAccessRehearsals}
<div class="rehearsals">
  <span>{$rt.title}</span>
  {#each rehearsals as rehearsal}<a href="{base}/rehearsals/{rehearsal.id}">{formatDate(rehearsal.date, $lang)} · {rehearsal.startTime}</a>{/each}
  {#if error}<span class="error">{$rt.error}</span>{/if}
  <a class="plan" href="{base}/rehearsals?new=1&setlist={encodeURIComponent(setlistId)}">+ {$rt.new}</a>
</div>
{/if}
<style>
  .rehearsals { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 12px 0 16px; font-size: .8rem; color: var(--text-muted); }
  a { border: 1px solid var(--border); border-radius: 7px; padding: 7px 10px; color: var(--text); text-decoration: none; background: var(--surface); } a:hover, .plan { color: var(--accent); } .error { color: #dc2626; }
</style>
