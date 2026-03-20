<script lang="ts">
  import type { Song, Instrument } from '$lib/types';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import { t } from '$lib/i18n';

  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', percussion: '🪘', violin: '🎻'
  };

  let {
    song,
    allMusicians,
    onedit,
    ondelete,
    onaddtosetlist
  }: {
    song: Song;
    allMusicians: string[];
    onedit: () => void;
    ondelete: () => void;
    onaddtosetlist: () => void;
  } = $props();
</script>

<tr class="song-row">
  <td class="td-artist">{song.artist}</td>
  <td class="td-title">{song.title}</td>
  <td class="td-cat"><CategoryBadge category={song.category} /></td>
  {#each allMusicians as name, i}
    {@const role = song.musicians[name]}
    <td class="td-musician" class:musician-alt={i % 2 === 0}>
      {#if role}
        <span class="role-cell">
          <span class="inst-slot">{role.instrument ? instrumentIcons[role.instrument] : ''}</span>{role.vocals ? '🎤' : ''}
        </span>
      {/if}
    </td>
  {/each}
  <td class="td-actions">
    <button class="action-btn" onclick={onaddtosetlist} title={$t.addToSetlist.title}>📋</button>
    <button class="action-btn" onclick={onedit} title={$t.song.editTitle}>✏️</button>
    <button class="action-btn danger" onclick={ondelete} title={$t.song.remove}>🗑</button>
  </td>
</tr>

<style>
  .song-row { border-bottom: 1px solid var(--border); }
  .song-row:hover { background: var(--row-hover); }
  td { padding: 8px 12px; font-size: 0.88rem; vertical-align: middle; }
  .td-artist { font-weight: 500; white-space: nowrap; }
  .td-cat { white-space: nowrap; }
  .td-musician { text-align: left; white-space: nowrap; }
  .musician-alt { background: var(--musician-alt-bg); }
  .role-cell { font-size: 1rem; display: inline-flex; align-items: center; }
  .inst-slot { display: inline-block; width: 1.3em; }

  .td-actions { white-space: nowrap; }
  .action-btn {
    background: none; border: none; cursor: pointer;
    padding: 4px 6px; border-radius: 4px; font-size: 0.85rem;
    opacity: 0.6; transition: opacity 0.12s;
  }
  .action-btn:hover { opacity: 1; }
  .action-btn.danger:hover { color: #ef4444; }
</style>
