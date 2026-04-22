<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import type { Song, Category, MusicianRole, Instrument, BandMusician, LearningStage } from '$lib/types';
  import { t } from '$lib/i18n';

  const allInstruments: Instrument[] = ['vocals', 'guitar', 'bass', 'keys', 'violin', 'drums', 'cajon', 'percussion'];
  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', percussion: '🪇', vocals: '🎤'
  };

  // Stages that appear as progress bar segments (in order)
  const PROGRESS_SEGS: LearningStage[] = ['structure', 'mastering', 'ready'];
  const STAGE_ORDER: LearningStage[] = ['queue', 'structure', 'mastering', 'ready'];
  const BAR_COLOR: Partial<Record<LearningStage, string>> = {
    structure: '#8A000A',
    mastering: '#856100',
    ready:     '#005909',
  };

  let {
    song,
    musicians,
    mode = 'backlog',
    onclose,
    onsave,
    ondelete,
    onaddtosetlist,
    onremove
  }: {
    song: Partial<Song> | null;
    musicians: BandMusician[];
    mode?: 'backlog' | 'entry';
    onclose: () => void;
    onsave: (s: Song) => void;
    ondelete?: () => void;
    onaddtosetlist?: () => void;
    onremove?: () => void;
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
    lengthMinutes: song?.lengthMinutes ?? 5,
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
  function mkGuest(name = '', instruments: Instrument[] = [], progress: LearningStage = 'queue'): GuestRow {
    return { id: _id++, name, instruments, progress };
  }

  function buildInitialGuests(): GuestRow[] {
    if (!song?.musicians) return [mkGuest()];
    const existing = Object.entries(song.musicians)
      .filter(([name]) => !permanentNames.has(name))
      .map(([name, role]) => mkGuest(name, [...(role.instruments ?? [])], song?.progress?.[name] ?? 'queue'));
    return [...existing, mkGuest()];
  }

  let guestRows = $state<GuestRow[]>(buildInitialGuests());

  function onGuestInput(row: GuestRow, value: string) {
    const isLast = row.id === guestRows[guestRows.length - 1].id;
    guestRows = guestRows.map(r => r.id === row.id ? { ...r, name: value } : r);
    if (isLast && value.trim()) guestRows = [...guestRows, mkGuest()];
  }

  function toggleGuestInstrument(row: GuestRow, inst: Instrument) {
    const has = row.instruments.includes(inst);
    const instruments = has ? row.instruments.filter(i => i !== inst) : [...row.instruments, inst];
    guestRows = guestRows.map(r => r.id === row.id ? { ...r, instruments } : r);
  }

  function removeGuest(id: number) {
    guestRows = guestRows.filter(r => r.id !== id);
    if (!guestRows.length || guestRows[guestRows.length - 1].name.trim()) {
      guestRows = [...guestRows, mkGuest()];
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  let guestsMissingInstrument = $derived(
    new Set(guestRows.filter(r => r.name.trim() && r.instruments.length === 0).map(r => r.id))
  );

  function handleSave(): boolean {
    if (!draft.artist.trim() || !draft.title.trim()) return false;
    if (guestsMissingInstrument.size > 0) return false;
    const allMusicians: Record<string, MusicianRole> = { ...draft.musicians };
    const allProgress: Record<string, LearningStage> = { ...(draft.progress ?? {}) };
    for (const row of guestRows) {
      if (row.name.trim() && row.instruments.length > 0) {
        allMusicians[row.name.trim()] = { instruments: row.instruments };
        allProgress[row.name.trim()] = row.progress;
      }
    }
    onsave({ ...draft, musicians: allMusicians, progress: allProgress });
    return true;
  }

  let dragStartedInModal = false;

  function handleBackdropMousedown(e: MouseEvent) {
    dragStartedInModal = !(e.target as HTMLElement).classList.contains('modal-backdrop');
  }

  function handleBackdrop(e: MouseEvent) {
    if (dragStartedInModal) { dragStartedInModal = false; return; }
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) closeModal();
  }

  // ── Mobile: full-screen + browser back-button support ─────────────────────

  let historyPushed = false;

  function handlePopstate() {
    historyPushed = false;
    onclose();
  }

  onMount(() => {
    if (!browser || window.innerWidth > 700) return;
    document.body.style.overflow = 'hidden';
    history.pushState({ kittenModal: true }, '');
    historyPushed = true;
    window.addEventListener('popstate', handlePopstate);
  });

  onDestroy(() => {
    if (!browser) return;
    document.body.style.overflow = '';
    window.removeEventListener('popstate', handlePopstate);
  });

  function closeModal() {
    if (browser) window.removeEventListener('popstate', handlePopstate);
    if (historyPushed) {
      historyPushed = false;
      history.back();
    }
    onclose();
  }

  let modalTitle = $derived(
    mode === 'entry'
      ? ($t.song.editTitle + ' (в сетлисте)')
      : (song?.id ? $t.song.editTitle : $t.song.addTitle)
  );
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onmousedown={handleBackdropMousedown} onclick={handleBackdrop}>
  <div class="modal">
    <div class="modal-header">
      <button class="back-btn" onclick={closeModal}>← {$t.song.cancel}</button>
      <h2>{modalTitle}</h2>
      <button class="close-btn" onclick={closeModal}>✕</button>
    </div>

    <div class="modal-body">
      <div class="fields-row">
        <div class="field">
          <label>{$t.song.artist}</label>
          <input bind:value={draft.artist} placeholder={$t.song.artist} />
        </div>
        <div class="field">
          <label>{$t.song.title}</label>
          <input bind:value={draft.title} placeholder={$t.song.title} />
        </div>
      </div>
      {#if mode !== 'entry'}
      <div class="cat-chips">
        {#each (['top', 'mid', 'low'] as Category[]) as cat}
          <button
            class="cat-chip cat-chip-{cat}"
            class:active={draft.category === cat}
            onclick={() => { draft.category = cat; }}
          >{$t.filter[cat]}</button>
        {/each}
      </div>
      {/if}

      <div class="musician-roster">

          <div class="roster-header">
            <span class="header-name">{$t.song.musicians}</span>
            <span class="row-gap"></span>
            <span class="header-instruments"></span>
            <span class="header-progress">Прогресс</span>
          </div>

          <!-- Permanent band members -->
          {#each musicians as bm}
            {@const role = draft.musicians[bm.name]}
            {@const curStage = (draft.progress?.[bm.name] ?? 'queue') as LearningStage}
            {@const hasInst = (role?.instruments?.length ?? 0) > 0}
            <div class="roster-row">
              <span class="roster-name">{bm.name}</span>
              <span class="row-gap"></span>
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
              {#if hasInst}
                <div class="prog-wrap">
                  <div class="prog-bar" style="--fill: {BAR_COLOR[curStage] ?? 'var(--border)'}">
                    {#each PROGRESS_SEGS as seg}
                      <button
                        class="prog-seg"
                        class:filled={STAGE_ORDER.indexOf(curStage) >= STAGE_ORDER.indexOf(seg)}
                        onclick={() => setProgress(bm.name, curStage === seg ? 'queue' : seg)}
                        title={$t.progress[seg]}
                      ></button>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/each}

          <!-- Ad-hoc guests — same layout, no divider -->
          {#each guestRows as row (row.id)}
            {@const isAdd = !row.name.trim()}
            {@const missingInst = guestsMissingInstrument.has(row.id)}
            <div class="roster-row" class:ghost-row={isAdd} class:row-error={missingInst}>
              <input
                class="roster-name guest-name"
                value={row.name}
                placeholder={isAdd ? '+ гость' : 'Имя'}
                oninput={(e) => onGuestInput(row, (e.target as HTMLInputElement).value)}
              />
              <span class="row-gap"></span>
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
              {#if !isAdd && row.instruments.length > 0}
                <div class="prog-wrap">
                  <div class="prog-bar" style="--fill: {BAR_COLOR[row.progress] ?? 'var(--border)'}">
                    {#each PROGRESS_SEGS as seg}
                      <button
                        class="prog-seg"
                        class:filled={STAGE_ORDER.indexOf(row.progress) >= STAGE_ORDER.indexOf(seg)}
                        onclick={() => { guestRows = guestRows.map(r => r.id === row.id ? { ...r, progress: r.progress === seg ? 'queue' : seg } : r); }}
                        title={$t.progress[seg]}
                      ></button>
                    {/each}
                  </div>
                </div>
              {/if}
              {#if !isAdd}
                <button class="remove-guest-btn" onclick={() => removeGuest(row.id)}>✕</button>
              {/if}
            </div>
          {/each}

        </div>

      <div class="fields-row">
        <div class="field" style="flex: 1">
          <label>{$t.song.comment}</label>
          <input bind:value={draft.comment} placeholder={$t.song.commentPlaceholder} />
        </div>
        <div class="field field-length">
          <label>{$t.song.length}</label>
          <div class="length-wrap">
            <input type="number" min="1" max="99" bind:value={draft.lengthMinutes} />
            <span class="length-unit">мин</span>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <div class="footer-left">
        {#if ondelete}
          <button class="btn-icon danger" onclick={() => { if (confirm($t.deleteConfirm)) { ondelete!(); closeModal(); } }} title={$t.song.remove}>🗑</button>
        {/if}
        {#if onaddtosetlist}
          <button class="btn-icon" onclick={() => { onaddtosetlist!(); closeModal(); }} title={$t.addToSetlist.title}>📋</button>
        {/if}
        {#if onremove}
          <button class="btn-remove-setlist danger" onclick={() => { if (confirm('Убрать из сетлиста?')) { onremove!(); closeModal(); } }} title="Убрать из сетлиста">− из сетлиста</button>
        {/if}
      </div>
      <div class="footer-right">
        <button class="btn-secondary" onclick={closeModal}>{$t.song.cancel}</button>
        <button class="btn-primary" onclick={() => { if (handleSave()) closeModal(); }}>{$t.song.save}</button>
      </div>
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
    width: 100%; max-width: 680px; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column;
  }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
  .modal-header h2 { margin: 0; font-size: 1.1rem; }
  .close-btn { background: none; border: none; cursor: pointer; font-size: 1rem; color: var(--text-muted); padding: 4px 8px; }
  .modal-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
  .modal-footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border); }
  .footer-left { display: flex; gap: 6px; }
  .footer-right { display: flex; gap: 8px; }
  .btn-icon {
    background: none; border: 1px solid var(--border); border-radius: 6px;
    cursor: pointer; font-size: 1.2rem; padding: 6px 10px;
    color: var(--text-muted); transition: border-color 0.12s, color 0.12s;
  }
  .btn-icon:hover { border-color: var(--accent); color: var(--text); }
  .btn-icon.danger:hover { border-color: #ef4444; color: #ef4444; }
  .btn-remove-setlist {
    background: none; border: 1px solid var(--border); border-radius: 6px;
    cursor: pointer; font-size: 0.82rem; padding: 6px 10px;
    color: var(--text-muted); transition: border-color 0.12s, color 0.12s;
  }
  .btn-remove-setlist:hover { border-color: #ef4444; color: #ef4444; }

  .fields-row { display: flex; gap: 12px; }
  .fields-row .field { flex: 1; }
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

  .roster-header {
    display: flex; align-items: center; gap: 8px;
    padding: 0 9px 4px;
    font-size: 0.82rem; font-weight: 600; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .header-name { flex-shrink: 0; width: 72px; overflow: visible; white-space: nowrap; }
  .header-instruments { flex-shrink: 0; width: 293px; }
  .header-progress { flex-shrink: 0; margin-left: 20px; }

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

  /* ── Progress bar ────────────────────────────────────────────────────── */

  .prog-wrap {
    margin-left: 20px; flex-shrink: 0;
    display: flex; align-items: center; gap: 6px;
  }

  .prog-bar {
    display: flex; gap: 2px;
  }

  .prog-seg {
    width: 36px; height: 20px;
    border: none; cursor: pointer; padding: 0;
    background: var(--border);
    transition: background 0.15s;
  }
  .prog-seg:first-child { border-radius: 5px 0 0 5px; }
  .prog-seg:last-child { border-radius: 0 5px 5px 0; }
  .prog-seg.filled { background: var(--fill, var(--accent)); }
  .prog-seg:hover { opacity: 0.75; }

  .ghost-row {
    border-style: dashed;
    opacity: 0.55;
  }
  .row-error { border-color: #ef4444; }
  .ghost-row:focus-within {
    opacity: 1;
    border-style: solid;
  }

  .row-gap { flex-shrink: 0; width: 20px; }
  .remove-guest-btn {
    margin-left: auto; flex-shrink: 0; width: 20px;
    background: none; border: none; cursor: pointer;
    color: var(--text-muted); font-size: 0.78rem; padding: 0;
    opacity: 0.5; transition: opacity 0.12s; text-align: center;
  }
  .remove-guest-btn:hover { opacity: 1; color: #ef4444; }

  .field-length { flex-shrink: 0; width: 110px; }
  .length-wrap { display: flex; align-items: center; gap: 6px; }
  .length-wrap input { width: 60px; }
  .length-unit { font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; }

  .btn-primary { padding: 8px 20px; background: var(--accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
  .btn-secondary { padding: 8px 20px; background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; }

  .back-btn { display: none; }

  @media (max-width: 700px) {
    /* Full-screen modal */
    .modal-backdrop { padding: 0; align-items: stretch; }
    .modal { max-width: none; max-height: none; border-radius: 0; height: 100dvh; }
    .modal-header { position: sticky; top: 0; z-index: 1; background: var(--surface); }
    .modal-header h2 { flex: 1; text-align: center; }
    .back-btn {
      display: flex; align-items: center; gap: 4px;
      background: none; border: none; cursor: pointer;
      color: var(--accent); font-size: 0.9rem; font-weight: 600; padding: 4px 0;
    }
    .close-btn { display: none; }
    .fields-row { flex-direction: column; }

    /* 2-line musician layout:
       Line 1: name  ···  progress bar
       Line 2: instrument buttons (full width) */
    .roster-header { display: none; }
    .roster-row { flex-wrap: wrap; gap: 6px 0; }
    .row-gap { display: none; }
    .roster-name { order: 1; min-width: 0; flex: 1 1 auto; width: auto; }
    .guest-name { order: 1; flex: 1 1 auto; min-width: 0; width: auto !important; }
    .prog-wrap { order: 2; margin-left: auto; }
    .prog-seg { height: 28px; width: 44px; }
    .remove-guest-btn { order: 3; margin-left: 8px; width: auto; }
    .inst-grid {
      order: 4; width: 100%;
      grid-template-columns: repeat(8, 1fr);
    }
    .inst-btn { width: 100%; height: 40px; }
    /* Ghost row: hide invisible inst-grid to avoid blank space */
    .ghost-row .inst-grid { display: none; }
  }
</style>
