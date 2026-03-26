<script lang="ts">
  import type { Song, Category, MusicianRole, Instrument, BandMusician, LearningStage } from '$lib/types';
  import { t } from '$lib/i18n';

  const allInstruments: Instrument[] = ['vocals', 'guitar', 'bass', 'keys', 'violin', 'drums', 'cajon', 'percussion'];
  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', percussion: '🪇', vocals: '🎤'
  };

  const STAGE_ORDER: LearningStage[] = ['nothing', 'queue', 'structure', 'mastering', 'ready'];
  const STAGE_LABEL: Record<LearningStage, string> = { nothing: 'N', queue: 'Q', structure: 'S', mastering: 'M', ready: 'R' };
  const STAGE_COLOR: Record<LearningStage, string> = {
    nothing: '#94a3b8', queue: '#cbd5e1', structure: '#f59e0b', mastering: '#3b82f6', ready: '#22c55e'
  };

  let {
    song,
    musicians,
    mode = 'backlog',
    onclose,
    onsave
  }: {
    song: Partial<Song> | null;
    musicians: BandMusician[];
    mode?: 'backlog' | 'entry';
    onclose: () => void;
    onsave: (s: Song) => void;
  } = $props();

  const permanentNames = new Set(musicians.map(m => m.name));

  // ── Permanent musicians ────────────────────────────────────────────────────

  function buildInitialMusicians(): Record<string, MusicianRole> {
    const result: Record<string, MusicianRole> = {};
    if (song?.musicians) {
      for (const [name, role] of Object.entries(song.musicians)) {
        if (permanentNames.has(name)) result[name] = { instruments: [...(role.instruments ?? [])] };
      }
    } else {
      for (const m of musicians) {
        result[m.name] = { instruments: m.defaultInstruments?.length ? [...m.defaultInstruments] : [] };
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
    sortOrder: song?.sortOrder,
    progress: { ...(song?.progress ?? {}) },
  });

  function toggleInstrument(name: string, inst: Instrument) {
    const role = draft.musicians[name] ?? { instruments: [] };
    const has = role.instruments.includes(inst);
    const instruments = has ? role.instruments.filter(i => i !== inst) : [...role.instruments, inst];
    draft.musicians = { ...draft.musicians, [name]: { instruments } };
  }

  function setProgress(name: string, stage: LearningStage) {
    draft.progress = { ...(draft.progress ?? {}), [name]: stage };
  }

  // ── Guest musicians (ad-hoc, per-song) ────────────────────────────────────

  type GuestRow = { id: number; name: string; instruments: Instrument[]; progress: LearningStage };
  let _id = 0;
  function mkGuest(name = '', instruments: Instrument[] = [], progress: LearningStage = 'nothing'): GuestRow {
    return { id: _id++, name, instruments, progress };
  }

  function buildInitialGuests(): GuestRow[] {
    if (!song?.musicians) return [mkGuest()];
    const existing = Object.entries(song.musicians)
      .filter(([name]) => !permanentNames.has(name))
      .map(([name, role]) => mkGuest(name, [...(role.instruments ?? [])], song?.progress?.[name] ?? 'nothing'));
    return [...existing, mkGuest()];
  }

  let guestRows = $state<GuestRow[]>(buildInitialGuests());

  function onGuestInput(row: GuestRow, value: string) {
    row.name = value;
    if (row.id === guestRows[guestRows.length - 1].id && value.trim()) {
      guestRows = [...guestRows, mkGuest()];
    }
  }

  function toggleGuestInstrument(row: GuestRow, inst: Instrument) {
    const has = row.instruments.includes(inst);
    row.instruments = has ? row.instruments.filter(i => i !== inst) : [...row.instruments, inst];
  }

  function removeGuest(id: number) {
    guestRows = guestRows.filter(r => r.id !== id);
    if (!guestRows.length || guestRows[guestRows.length - 1].name.trim()) {
      guestRows = [...guestRows, mkGuest()];
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  function handleSave() {
    if (!draft.artist.trim() || !draft.title.trim()) return;
    const allMusicians: Record<string, MusicianRole> = { ...draft.musicians };
    const allProgress: Record<string, LearningStage> = { ...(draft.progress ?? {}) };
    for (const row of guestRows) {
      if (row.name.trim()) {
        allMusicians[row.name.trim()] = { instruments: row.instruments };
        allProgress[row.name.trim()] = row.progress;
      }
    }
    const hasVocals = Object.values(allMusicians).some(r => r.instruments.includes('vocals'));
    if (!hasVocals) { alert('А поёт эту хуйню кто?'); return; }
    onsave({ ...draft, musicians: allMusicians, progress: allProgress });
  }

  function handleBackdrop(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) onclose();
  }

  let modalTitle = $derived(
    mode === 'entry'
      ? ($t.song.editTitle + ' (в сетлисте)')
      : (song?.id ? $t.song.editTitle : $t.song.addTitle)
  );
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={handleBackdrop}>
  <div class="modal">
    <div class="modal-header">
      <h2>{modalTitle}</h2>
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
        <div class="cat-chips">
          {#each (['top', 'mid', 'low'] as Category[]) as cat}
            <button
              class="cat-chip cat-chip-{cat}"
              class:active={draft.category === cat}
              onclick={() => { draft.category = cat; }}
            >{$t.filter[cat]}</button>
          {/each}
        </div>
      </div>

      <div class="field">
        <label>{$t.song.musicians}</label>
        <div class="musician-roster">

          <!-- Permanent band members -->
          {#each musicians as bm}
            {@const role = draft.musicians[bm.name]}
            {@const curStage = (draft.progress?.[bm.name] ?? 'nothing') as LearningStage}
            <div class="roster-row">
              <span class="roster-name">{bm.name}</span>
              <div class="inst-grid">
                {#each allInstruments as inst}
                  <button
                    class="inst-btn"
                    class:active={role?.instruments?.includes(inst)}
                    onclick={() => toggleInstrument(bm.name, inst)}
                    title={$t.instrument[inst]}
                  >{instrumentIcons[inst]}</button>
                {/each}
              </div>
              <div class="stage-pills">
                {#each STAGE_ORDER as stage}
                  <button
                    class="stage-pill"
                    class:active={curStage === stage}
                    style="--stage-color: {STAGE_COLOR[stage]}"
                    onclick={() => setProgress(bm.name, stage)}
                    title={$t.progress[stage]}
                  >{STAGE_LABEL[stage]}</button>
                {/each}
              </div>
            </div>
          {/each}

          <!-- Ad-hoc guests — same layout, no divider -->
          {#each guestRows as row (row.id)}
            {@const isAdd = !row.name.trim()}
            <div class="roster-row" class:ghost-row={isAdd}>
              <input
                class="roster-name guest-name"
                value={row.name}
                placeholder={isAdd ? '+ гость' : 'Имя'}
                oninput={(e) => onGuestInput(row, (e.target as HTMLInputElement).value)}
              />
              <div class="inst-grid">
                {#each allInstruments as inst}
                  <button
                    class="inst-btn"
                    class:active={row.instruments.includes(inst)}
                    class:invisible={isAdd}
                    onclick={() => !isAdd && toggleGuestInstrument(row, inst)}
                    title={$t.instrument[inst]}
                    tabindex={isAdd ? -1 : 0}
                  >{instrumentIcons[inst]}</button>
                {/each}
              </div>
              {#if !isAdd}
                <div class="stage-pills">
                  {#each STAGE_ORDER as stage}
                    <button
                      class="stage-pill"
                      class:active={row.progress === stage}
                      style="--stage-color: {STAGE_COLOR[stage]}"
                      onclick={() => { row.progress = stage; }}
                      title={$t.progress[stage]}
                    >{STAGE_LABEL[stage]}</button>
                  {/each}
                </div>
                <button class="remove-guest-btn" onclick={() => removeGuest(row.id)}>✕</button>
              {:else}
                <div class="stage-pills invisible"></div>
              {/if}
            </div>
          {/each}

        </div>
      </div>

      <div class="field">
        <label>{$t.song.comment}</label>
        <input bind:value={draft.comment} placeholder={$t.song.commentPlaceholder} />
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
    width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column;
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
  .cat-chips { display: flex; gap: 6px; }
  .cat-chip {
    padding: 5px 16px; border-radius: 20px; border: 1px solid var(--border);
    background: transparent; cursor: pointer; font-size: 0.85rem; font-weight: 500;
    color: var(--text-muted); transition: all 0.15s;
  }
  .cat-chip-top.active { background: #b91c1c; border-color: #ef4444; color: #fff; }
  .cat-chip-mid.active { background: #7c3aed; border-color: #a78bfa; color: #fff; }
  .cat-chip-low.active { background: #15803d; border-color: #22c55e; color: #fff; }
  .cat-chip:not(.active):hover { border-color: var(--accent); color: var(--accent); }

  /* ── Musician roster ──────────────────────────────────────────────────── */

  .musician-roster { display: flex; flex-direction: column; gap: 4px; }

  .roster-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg);
  }

  /* Fixed-width name column so inst grid aligns across all rows */
  .roster-name {
    font-weight: 600; font-size: 0.9rem;
    width: 72px; flex-shrink: 0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* Guest name as an unstyled inline input, same size */
  .guest-name {
    padding: 0 !important; border: none !important; background: transparent !important;
    width: 72px !important; box-sizing: border-box !important;
    color: var(--text);
  }
  .ghost-row .guest-name { font-weight: 400; color: var(--text-muted); }

  /* Fixed 8-column grid — one cell per instrument, perfectly aligned */
  .inst-grid {
    display: grid;
    grid-template-columns: repeat(8, 34px);
    gap: 3px;
    flex-shrink: 0;
  }

  .inst-btn {
    width: 34px; height: 34px; font-size: 1.35rem;
    border: 1px solid var(--border); border-radius: 6px;
    background: transparent; cursor: pointer; transition: all 0.12s;
  }
  .inst-btn:hover { border-color: var(--accent); }
  .inst-btn.active { background: var(--accent); border-color: var(--accent); }
  .inst-btn.invisible { visibility: hidden; pointer-events: none; }

  /* ── Stage progress pills ─────────────────────────────────────────────── */

  .stage-pills {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }
  .stage-pills.invisible { visibility: hidden; }

  .stage-pill {
    width: 22px; height: 22px;
    border-radius: 50%;
    border: 1.5px solid var(--stage-color);
    background: transparent;
    color: var(--stage-color);
    font-size: 0.62rem;
    font-weight: 700;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.12s;
    padding: 0;
  }
  .stage-pill.active {
    background: var(--stage-color);
    color: #fff;
  }
  .stage-pill:hover:not(.active) {
    opacity: 0.7;
  }

  .ghost-row {
    border-style: dashed;
    opacity: 0.55;
  }
  .ghost-row:focus-within {
    opacity: 1;
    border-style: solid;
  }

  .remove-guest-btn {
    flex-shrink: 0; background: none; border: none; cursor: pointer;
    color: var(--text-muted); font-size: 0.78rem; padding: 2px 4px;
    border-radius: 4px; opacity: 0.5; transition: opacity 0.12s; margin-left: auto;
  }
  .remove-guest-btn:hover { opacity: 1; color: #ef4444; }

  .btn-primary { padding: 8px 20px; background: var(--accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
  .btn-secondary { padding: 8px 20px; background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; }
</style>
