<script lang="ts">
  import type { Song, Category, MusicianRole, Instrument, BandMusician } from '$lib/types';
  import { t } from '$lib/i18n';

  const allInstruments: Instrument[] = ['guitar', 'bass', 'drums', 'keys', 'percussion', 'violin'];
  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', percussion: '🪘', violin: '🎻'
  };

  let {
    song,
    musicians,
    onclose,
    onsave
  }: {
    song: Partial<Song> | null;
    musicians: BandMusician[];
    onclose: () => void;
    onsave: (s: Song) => void;
  } = $props();

  let bandMusicians = $derived(musicians);

  // Build initial musicians map from song, filling in band roster defaults
  function buildInitialMusicians(): Record<string, MusicianRole> {
    const result: Record<string, MusicianRole> = {};
    if (song?.musicians) {
      for (const [name, role] of Object.entries(song.musicians)) {
        result[name] = { ...role };
      }
    } else {
      for (const m of musicians) {
        result[m.name] = {
          instrument: m.defaultInstrument,
          vocals: false
        };
      }
    }
    return result;
  }

  let draft = $state<Song>({
    id: song?.id ?? '',
    artist: song?.artist ?? '',
    title: song?.title ?? '',
    category: song?.category ?? 'mid',
    comment: song?.comment ?? '',
    musicians: buildInitialMusicians(),
    extraMusicians: song?.extraMusicians ?? '',
    sortOrder: song?.sortOrder
  });

  function toggleInstrument(name: string, inst: Instrument) {
    const role = draft.musicians[name] ?? { instrument: undefined, vocals: false };
    // clicking the active instrument deselects it (free); clicking another selects it
    const next: MusicianRole = {
      ...role,
      instrument: role.instrument === inst ? undefined : inst
    };
    draft.musicians = { ...draft.musicians, [name]: next };
  }

  function toggleVocals(name: string) {
    const role = draft.musicians[name] ?? { instrument: undefined, vocals: false };
    draft.musicians = { ...draft.musicians, [name]: { ...role, vocals: !role.vocals } };
  }

  function handleSave() {
    if (!draft.artist.trim() || !draft.title.trim()) return;
    const hasVocals = Object.values(draft.musicians).some(r => r.vocals);
    if (!hasVocals) { alert('А поёт эту хуйню кто?'); return; }
    onsave(draft);
  }

  function handleBackdrop(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) onclose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={handleBackdrop}>
  <div class="modal">
    <div class="modal-header">
      <h2>{song?.id ? $t.song.editTitle : $t.song.addTitle}</h2>
      <button class="close-btn" onclick={onclose}>✕</button>
    </div>

    <div class="modal-body">
      <div class="field">
        <label>{$t.song.artist}</label>
        <input bind:value={draft.artist} placeholder={$t.song.artist} />
      </div>
      <div class="field">
        <label>{$t.song.title}</label>
        <input bind:value={draft.title} placeholder={$t.song.title} />
      </div>
      <div class="field">
        <label>{$t.song.category}</label>
        <div class="radio-group">
          {#each (['top', 'mid', 'low'] as Category[]) as cat}
            <label class="radio-label">
              <input type="radio" bind:group={draft.category} value={cat} />
              {$t.filter[cat]}
            </label>
          {/each}
        </div>
      </div>
      <div class="field">
        <label>{$t.song.comment}</label>
        <input bind:value={draft.comment} placeholder={$t.song.commentPlaceholder} />
      </div>

      <div class="field">
        <label>{$t.song.musicians}</label>
        <div class="musician-roster">
          {#each bandMusicians as bm}
            {@const role = draft.musicians[bm.name]}
            <div class="roster-row">
              <span class="roster-name">{bm.name}</span>

              <div class="inst-row">
                {#each allInstruments as inst}
                  <button
                    class="inst-btn"
                    class:active={role?.instrument === inst}
                    onclick={() => toggleInstrument(bm.name, inst)}
                    title={role?.instrument === inst ? $t.musicians.free : $t.instrument[inst]}
                  >{instrumentIcons[inst]}</button>
                {/each}
                {#if !role?.instrument}
                  <span class="free-label">{$t.musicians.noInstrument}</span>
                {/if}
              </div>
              <button
                class="vocals-btn"
                class:active={role?.vocals}
                onclick={() => toggleVocals(bm.name)}
                title="Vocals"
              >🎤</button>
            </div>
          {/each}
        </div>
      </div>

      <div class="field">
        <label>{$t.song.extraMusicians}</label>
        <input bind:value={draft.extraMusicians} placeholder={$t.song.extraPlaceholder} />
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" onclick={onclose}>{$t.song.cancel}</button>
      <button class="btn-primary" onclick={handleSave}>{$t.song.save}</button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px;
  }
  .modal {
    background: var(--surface); border-radius: 12px;
    width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column;
  }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
  .modal-header h2 { margin: 0; font-size: 1.1rem; }
  .close-btn { background: none; border: none; cursor: pointer; font-size: 1rem; color: var(--text-muted); padding: 4px 8px; }
  .modal-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border); }

  .field { display: flex; flex-direction: column; gap: 6px; }
  .field > label { font-size: 0.82rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
  input:not([type="radio"]):not([type="checkbox"]) {
    padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px;
    background: var(--bg); color: var(--text); font-size: 0.9rem; width: 100%; box-sizing: border-box;
  }
  .radio-group { display: flex; gap: 16px; }
  .radio-label { display: flex; align-items: center; gap: 4px; font-size: 0.9rem; cursor: pointer; }

  .musician-roster { display: flex; flex-direction: column; gap: 4px; }

  .roster-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg);
    transition: opacity 0.15s;
  }
  .roster-name { font-weight: 600; font-size: 0.9rem; min-width: 64px; }

  .inst-row { display: flex; gap: 4px; flex: 1; }
  .inst-btn {
    width: 28px; height: 28px; font-size: 0.9rem;
    border: 1px solid var(--border); border-radius: 6px;
    background: transparent; cursor: pointer; transition: all 0.12s;
  }
  .inst-btn:hover { border-color: var(--accent); }
  .inst-btn.active { background: var(--accent); border-color: var(--accent); }

  .free-label { font-size: 0.75rem; color: var(--text-muted); font-style: italic; align-self: center; }

  .vocals-btn {
    width: 28px; height: 28px; font-size: 0.9rem;
    border: 1px solid var(--border); border-radius: 6px;
    background: transparent; cursor: pointer; transition: all 0.12s; flex-shrink: 0;
  }
  .vocals-btn:hover { border-color: var(--accent); }
  .vocals-btn.active { background: var(--accent); border-color: var(--accent); }

  .btn-primary { padding: 8px 20px; background: var(--accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
  .btn-secondary { padding: 8px 20px; background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; }
</style>
