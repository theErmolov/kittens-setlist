<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import LoadingCat from '$components/shared/LoadingCat.svelte';
  import { getOnlinePresence, getSetlists } from '$lib/api';
  import { t } from '$lib/i18n';
  import type { PresenceEntry } from '$lib/types';

  let entries = $state<PresenceEntry[]>([]);
  let setlistNames = $state<Record<string, string>>({});
  let loading = $state(true);
  let failed = $state(false);
  let now = $state(Date.now());
  const people = $derived.by(() => {
    const grouped = new Map<string, { name: string; rooms: Map<string, Set<string>> }>();
    for (const entry of entries) {
      if (entry.expiresAt * 1000 <= now) continue;
      const key = entry.userId ?? `guest:${entry.clientId}`;
      let person = grouped.get(key);
      if (!person) {
        person = { name: entry.userId ? entry.name : $t.admin.onlineGuest, rooms: new Map() };
        grouped.set(key, person);
      }
      let tabs = person.rooms.get(entry.room);
      if (!tabs) { tabs = new Set(); person.rooms.set(entry.room, tabs); }
      tabs.add(entry.clientId);
    }
    return [...grouped.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  });

  onMount(() => {
    let stopped = false;
    let busy = false;
    async function refresh() {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const loaded = await getOnlinePresence();
        if (!stopped) { entries = loaded; failed = false; now = Date.now(); }
      } catch {
        if (!stopped) { entries = []; failed = true; }
      } finally {
        busy = false;
        if (!stopped) loading = false;
      }
    }
    void refresh();
    getSetlists().then(setlists => {
      if (!stopped) setlistNames = Object.fromEntries(setlists.map(setlist => [setlist.id, setlist.name]));
    }).catch(() => {});
    const timer = setInterval(() => { now = Date.now(); void refresh(); }, 10_000);
    const visible = () => { now = Date.now(); void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  });

  function roomHref(room: string): string {
    return room === 'backlog' ? `${base}/backlog` : `${base}/setlists/${encodeURIComponent(room.slice(8))}`;
  }
  function roomLabel(room: string): string {
    return room === 'backlog' ? $t.nav.backlog : setlistNames[room.slice(8)] ?? $t.admin.onlineSetlist;
  }
</script>

<section class="online-panel" aria-labelledby="online-title">
  <h2 id="online-title">{$t.admin.onlineTitle}{#if !loading && !failed} <span class="count">{people.length}</span>{/if}</h2>
  {#if loading}
    <LoadingCat />
  {:else if failed}
    <p class="error" role="status">{$t.admin.onlineUnavailable}</p>
  {:else if people.length === 0}
    <p class="hint">{$t.admin.onlineEmpty}</p>
  {:else}
    <ul>
      {#each people as [id, person] (id)}
        <li>
          <span class="person"><span class="dot" aria-hidden="true"></span>{person.name}</span>
          <span class="pages">
            {#each [...person.rooms] as [room, tabs] (room)}
              <a href={roomHref(room)}>{roomLabel(room)}{#if tabs.size > 1}{' ×'}{tabs.size}{/if}</a>
            {/each}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
  <p class="hint scope">{$t.admin.onlineHint}</p>
</section>

<style>
  .online-panel { padding: 14px 16px; margin-bottom: 20px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
  h2 { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 0.9rem; font-weight: 650; }
  .count { color: var(--text-muted); font-size: 0.8rem; font-weight: 500; }
  ul { list-style: none; }
  li { display: flex; align-items: baseline; gap: 12px; padding: 6px 0; }
  .person { display: flex; align-items: center; gap: 7px; min-width: 0; font-size: 0.85rem; overflow-wrap: anywhere; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }
  .pages { display: flex; flex-wrap: wrap; gap: 6px 12px; min-width: 0; }
  a { color: var(--accent); font-size: 0.8rem; overflow-wrap: anywhere; }
  a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .hint { font-size: 0.78rem; color: var(--text-muted); line-height: 1.5; }
  .scope { margin-top: 10px; }
  .error { color: #dc2626; font-size: 0.82rem; }
  @media (max-width: 760px) {
    li { flex-direction: column; gap: 4px; }
    .pages { padding-left: 13px; }
  }
</style>
