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

  const instruments: Instrument[] = ['vocals', 'guitar', 'bass', 'keys', 'violin', 'drums', 'cajon', 'percussion'];

  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', percussion: '🪇', vocals: '🎤'
  };
</script>

<div class="picker">
  <span class="musician-name">{name}</span>
  <div class="controls">
    <div class="instrument-btns">
      {#each instruments as inst}
        <button
          class="inst-btn"
          class:active={role.instruments.includes(inst)}
          onclick={() => {
            const has = role.instruments.includes(inst);
            onchange({ instruments: has ? role.instruments.filter(i => i !== inst) : [...role.instruments, inst] });
          }}
          title={$t.instrument[inst]}
        >
          {instrumentIcons[inst]}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .picker { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
  .musician-name { min-width: 80px; font-weight: 500; font-size: 0.9rem; color: var(--text); }
  .controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .instrument-btns { display: flex; gap: 4px; flex-wrap: wrap; }
  .inst-btn {
    width: 30px; height: 30px;
    border: 1px solid var(--border); border-radius: 6px;
    background: transparent; cursor: pointer; font-size: 0.9rem; transition: all 0.12s;
  }
  .inst-btn:hover { border-color: var(--accent); }
  .inst-btn.active { background: var(--accent); border-color: var(--accent); }
</style>
