<script lang="ts">
  import type { Instrument, MusicianRole } from '$lib/types';
  import { t } from '$lib/i18n';

  let {
    name,
    role,
    onchange
  }: {
    name: string;
    role: MusicianRole;
    onchange: (role: MusicianRole) => void;
  } = $props();

  const instruments: Instrument[] = ['guitar', 'bass', 'drums', 'keys', 'percussion', 'violin'];

  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', percussion: '🪘', violin: '🎻'
  };
</script>

<div class="picker">
  <span class="musician-name">{name}</span>
  <div class="controls">
    <div class="instrument-btns">
      {#each instruments as inst}
        <button
          class="inst-btn"
          class:active={role.instrument === inst}
          onclick={() => onchange({ ...role, instrument: inst })}
          title={$t.instrument[inst]}
        >
          {instrumentIcons[inst]}
        </button>
      {/each}
    </div>
    <label class="vocals-label">
      <input
        type="checkbox"
        checked={role.vocals}
        onchange={e => onchange({ ...role, vocals: (e.target as HTMLInputElement).checked })}
      />
      {$t.song.vocals}
    </label>
  </div>
</div>

<style>
  .picker { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
  .musician-name { min-width: 80px; font-weight: 500; font-size: 0.9rem; color: var(--text); }
  .controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .instrument-btns { display: flex; gap: 4px; }
  .inst-btn {
    width: 30px; height: 30px;
    border: 1px solid var(--border); border-radius: 6px;
    background: transparent; cursor: pointer; font-size: 0.9rem; transition: all 0.12s;
  }
  .inst-btn:hover { border-color: var(--accent); }
  .inst-btn.active { background: var(--accent); border-color: var(--accent); }
  .vocals-label { display: flex; align-items: center; gap: 4px; font-size: 0.82rem; cursor: pointer; color: var(--text-muted); }
</style>
