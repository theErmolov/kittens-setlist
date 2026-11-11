<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import type { Song, Category, MusicianRole, Instrument, BandMusician, LearningStage } from '$lib/types';
  import { below } from '$lib/breakpoints';
  import LearningProgress from '$components/shared/LearningProgress.svelte';
  import { t } from '$lib/i18n';
  import { useStore } from '$lib/store/bridge';
  import { songEditStore } from '$lib/store/backlog';
  import * as Dialog from '$components/ui/dialog';
  import * as Tooltip from '$components/ui/tooltip';
  import IconButton from '$components/shared/IconButton.svelte';
  import * as AlertDialog from '$components/ui/alert-dialog';
  import * as Tabs from '$components/ui/tabs';
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Textarea } from '$components/ui/textarea';
  import { Label } from '$components/ui/label';
  import * as Table from '$components/ui/table';
  import { createSvelteTable, FlexRender, renderSnippet } from '$components/ui/data-table';
  import { getCoreRowModel, type ColumnDef } from '@tanstack/table-core';
  import { ToggleGroup, ToggleGroupItem } from '$components/ui/toggle-group';

  const allInstruments: Instrument[] = ['vocals', 'guitar', 'bass', 'keys', 'violin', 'saxophone', 'trumpet', 'drums', 'cajon', 'percussion'];
  const instrumentIcons: Record<Instrument, string> = {
    guitar: '🎸', bass: '🪕', drums: '🥁', keys: '🎹', cajon: '🪘', violin: '🎻', saxophone: '🎷', trumpet: '🎺', percussion: '🪇', vocals: '🎤'
  };

  let {
    song,
    musicians,
    mode = 'backlog',
    personalOnly = false,
    onclose,
    onsave,
    ondelete,
    onaddtosetlist,
    onremove
  }: {
    song: Partial<Song> | null;
    musicians: BandMusician[];
    mode?: 'backlog' | 'entry' | 'setlist-only';
    personalOnly?: boolean;
    onclose: () => void;
    onsave: (s: Song) => Promise<void> | void;
    ondelete?: () => void;
    onaddtosetlist?: () => void;
    onremove?: () => void;
  } = $props();

  songEditStore.getState().init(song, musicians, mode);
  const draftStore = useStore(songEditStore, s => s.draft);
  const guestRowsStore = useStore(songEditStore, s => s.guestRows);
  const activeTab = useStore(songEditStore, s => s.activeTab);
  const saving = useStore(songEditStore, s => s.saving);
  const saveFailed = useStore(songEditStore, s => s.saveFailed);
  const confirmKind = useStore(songEditStore, s => s.confirm);
  const actions = songEditStore.getState();
  const setField = actions.setField;
  const labelClass = 'text-[0.82rem] font-semibold tracking-[0.04em] text-muted-foreground uppercase';
  const instClass = 'px-0 text-[1.35rem] data-[state=on]:bg-primary min-w-0 flex-1';
  const catActive: Record<Category, string> = {
    top: 'data-[state=on]:border-transparent data-[state=on]:bg-warning data-[state=on]:text-warning-ink',
    mid: 'data-[state=on]:border-transparent data-[state=on]:bg-info data-[state=on]:text-info-ink',
    low: 'data-[state=on]:border-transparent data-[state=on]:bg-success data-[state=on]:text-success-ink',
  };
  const numberOrNull = (v: string) => v === '' ? null : Number(v);

  let guestsMissingInstrument = $derived(
    new Set($guestRowsStore.filter(r => r.name.trim() && r.instruments.length === 0).map(r => r.id))
  );

  // ── Roster Data Table (members + guests) ───────────────────────────────────
  type RosterRow = { key: string; kind: 'member'; name: string } | { key: string; kind: 'guest'; id: number };
  const guestOf = (id: number) => $guestRowsStore.find(g => g.id === id);
  let rosterRows = $derived<RosterRow[]>([
    ...musicians.map((bm): RosterRow => ({ key: `m:${bm.name}`, kind: 'member', name: bm.name })),
    ...$guestRowsStore.map((g): RosterRow => ({ key: `g:${g.id}`, kind: 'guest', id: g.id })),
  ]);
  const rosterColumns: ColumnDef<RosterRow>[] = [
    { id: 'name', header: () => $t.song.musicians, cell: ({ row }) => renderSnippet(nameCell as never, row.original),
      meta: { cell: 'max-[640px]:order-1 max-[640px]:min-w-0 max-[640px]:flex-1' } },
    { id: 'instruments', header: () => '', cell: ({ row }) => renderSnippet(instCell as never, row.original),
      meta: { cell: 'w-full max-[640px]:order-3 max-[640px]:basis-full' } },
    { id: 'progress', header: () => $t.song.progress, cell: ({ row }) => renderSnippet(progCell as never, row.original),
      meta: { cell: 'max-[640px]:order-2' } },
  ];
  const table = createSvelteTable<RosterRow>({
    get data() { return rosterRows; },
    columns: rosterColumns,
    getRowId: r => r.key,
    getCoreRowModel: getCoreRowModel(),
  });

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave(): Promise<boolean> {
    const { draft, guestRows, saving } = songEditStore.getState();
    if (saving) return false;
    if (personalOnly) return persist({ ...draft });
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
    return persist({ ...draft, musicians: allMusicians, progress: allProgress });
  }

  async function persist(updated: Song): Promise<boolean> {
    actions.setSaving(true);
    actions.setSaveFailed(false);
    try { await onsave(updated); return true; }
    catch { actions.setSaveFailed(true); return false; }
    finally { actions.setSaving(false); }
  }

  async function toggleArchive() {
    setField('archived', !songEditStore.getState().draft.archived);
    if (await handleSave()) closeModal();
  }

  // ── Mobile: full-screen + browser back-button support ─────────────────────

  let historyPushed = false;

  function handlePopstate() {
    historyPushed = false;
    onclose();
  }

  onMount(() => {
    if (!browser || !below('mid').matches) return;
    history.pushState({ kittenModal: true }, '');
    historyPushed = true;
    window.addEventListener('popstate', handlePopstate);
  });

  onDestroy(() => {
    if (!browser) return;
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
    personalOnly ? $t.common.personalComment : mode === 'entry'
      ? ($t.song.editTitle + ' ' + $t.song.entrySuffix)
      : mode === 'setlist-only'
        ? (song?.id ? $t.song.editSetlistOnlyTitle : $t.song.addSetlistOnlyTitle)
      : (song?.id ? $t.song.editTitle : $t.song.addTitle)
  );
</script>

{#snippet nameCell(r: RosterRow)}
  {#if r.kind === 'member'}
    <span class="block w-[88px] truncate font-semibold max-[760px]:w-auto">{r.name}</span>
  {:else}
    {@const g = guestOf(r.id)}
    <Input
      class="w-[88px] rounded-none border-0 bg-transparent p-0 text-[0.9rem] shadow-none focus-visible:ring-0 max-[760px]:w-full max-[760px]:text-base dark:bg-transparent {g?.name.trim() ? 'font-semibold' : 'font-normal'}"
      value={g?.name ?? ''}
      placeholder={g?.name.trim() ? $t.song.guestNamePlaceholder : $t.song.guestPlaceholder}
      aria-label={$t.song.guestNamePlaceholder}
      oninput={(e) => actions.setGuestName(r.id, e.currentTarget.value)}
    />
  {/if}
{/snippet}

{#snippet instCell(r: RosterRow)}
  {#if r.kind === 'member'}
    {@render instruments($draftStore.musicians[r.name]?.instruments ?? [], v => actions.setInstruments(r.name, v))}
  {:else}
    {@const g = guestOf(r.id)}
    {#if g?.name.trim()}{@render instruments(g.instruments, v => actions.setGuestInstruments(r.id, v))}{/if}
  {/if}
{/snippet}

{#snippet progCell(r: RosterRow)}
  {#if r.kind === 'member'}
    {#if ($draftStore.musicians[r.name]?.instruments?.length ?? 0) > 0}
      <LearningProgress name={r.name} value={($draftStore.progress?.[r.name] ?? 'queue') as LearningStage} onchange={stage => actions.setProgress(r.name, stage)} />
    {/if}
  {:else}
    {@const g = guestOf(r.id)}
    {#if g?.name.trim()}
      <div class="flex items-center gap-2">
        {#if g.instruments.length > 0}<LearningProgress name={g.name} value={g.progress} onchange={stage => actions.setGuestProgress(r.id, stage)} />{/if}
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button {...props} variant="ghost" size="icon-xs" class="ml-auto shrink-0 text-muted-foreground opacity-60 hover:text-destructive hover:opacity-100" aria-label={$t.song.remove} onclick={() => actions.removeGuest(r.id)}>✕</Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>{$t.song.remove}</Tooltip.Content>
        </Tooltip.Root>
      </div>
    {/if}
  {/if}
{/snippet}

{#snippet instruments(selected: Instrument[], onchange: (v: Instrument[]) => void)}
  <ToggleGroup
    type="multiple"
    variant="outline"
    spacing={0.75}
    class="w-full"
    value={selected}
    onValueChange={v => onchange(v as Instrument[])}
  >
    {#each allInstruments as inst}
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <ToggleGroupItem {...props} value={inst} class={instClass} aria-label={$t.instrument[inst]}>{instrumentIcons[inst]}</ToggleGroupItem>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content>{$t.instrument[inst]}</Tooltip.Content>
      </Tooltip.Root>
    {/each}
  </ToggleGroup>
{/snippet}

<!-- Always mounted by its parent while visible, so `open` is constant and any dismissal (X, Esc, outside) goes through closeModal. -->
<Dialog.Root open onOpenChange={(open) => { if (!open) closeModal(); }}>
  <Dialog.Content
    class="flex h-[min(820px,calc(100dvh-2rem))] flex-col gap-4 rounded-2xl sm:max-w-[760px] max-[760px]:top-0 max-[760px]:left-0 max-[760px]:h-dvh max-[760px]:w-screen max-[760px]:max-w-none max-[760px]:translate-x-0 max-[760px]:translate-y-0 max-[760px]:rounded-none max-[760px]:ring-0"
  >
    <Dialog.Header class="shrink-0 pr-8">
      <Dialog.Title class="text-[1.2rem] leading-tight font-bold">{modalTitle}</Dialog.Title>
      <Dialog.Description class="sr-only">{$draftStore.artist} {$draftStore.title}</Dialog.Description>
    </Dialog.Header>

    <div class="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain pr-3 [scrollbar-gutter:stable]">
      {#if personalOnly}
        <p>{$draftStore.artist} — {$draftStore.title}</p>
      {:else}
      <fieldset disabled={$saving} class="m-0 flex min-w-0 flex-col gap-3.5 border-0 p-0 {$activeTab === 'lyrics' ? 'flex-1' : ''}">
        <div class="flex flex-col gap-3 min-[761px]:flex-row">
          <div class="flex flex-1 flex-col gap-1.5">
            <Label for="song-editor-artist" class={labelClass}>{$t.song.artist}</Label>
            <Input id="song-editor-artist" value={$draftStore.artist} oninput={e => setField('artist', e.currentTarget.value)} placeholder={$t.song.artist} />
          </div>
          <div class="flex flex-1 flex-col gap-1.5">
            <Label for="song-editor-title" class={labelClass}>{$t.song.title}</Label>
            <Input id="song-editor-title" value={$draftStore.title} oninput={e => setField('title', e.currentTarget.value)} placeholder={$t.song.title} />
          </div>
        </div>

        <Tabs.Root value={$activeTab} onValueChange={v => actions.setActiveTab(v as 'details' | 'lyrics')} class="min-h-0 {$activeTab === 'lyrics' ? 'flex-1' : ''}">
          <Tabs.List variant="line" class="w-full justify-start border-b">
            <Tabs.Trigger value="details" class="flex-none px-4">{$t.song.detailsTab}</Tabs.Trigger>
            <Tabs.Trigger value="lyrics" class="flex-none px-4">{$t.song.lyricsTab}</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="details" class="flex flex-col gap-3.5 pt-2">
            {#if mode !== 'entry'}
              <ToggleGroup
                type="single"
                variant="outline"
                spacing={1.5}
                class="max-w-full flex-wrap"
                value={$draftStore.category}
                onValueChange={v => { if (v) setField('category', v as Category); }}
                aria-label={$t.backlog.cols.cat}
              >
                {#each (['top', 'mid', 'low'] as Category[]) as cat}
                  <ToggleGroupItem
                    value={cat}
                    class="px-4 text-[0.85rem] text-muted-foreground {catActive[cat]}"
                  >{$t.filter[cat]}</ToggleGroupItem>
                {/each}
              </ToggleGroup>
            {/if}

            <div class="flex flex-col gap-1.5">
              <!-- Roster Data Table: permanent members first, then ad-hoc guests; the trailing empty guest row is a ghost "add" row. -->
              <Table.Root class="max-[640px]:block">
                <Table.Header class="max-[640px]:hidden">
                  {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
                    <Table.Row class="hover:bg-transparent">
                      {#each headerGroup.headers as header (header.id)}
                        <Table.Head><FlexRender content={header.column.columnDef.header} context={header.getContext()} /></Table.Head>
                      {/each}
                    </Table.Row>
                  {/each}
                </Table.Header>
                <Table.Body class="max-[640px]:block">
                  {#each table.getRowModel().rows as row (row.id)}
                    {@const r = row.original}
                    {@const isAdd = r.kind === 'guest' && !guestOf(r.id)?.name.trim()}
                    {@const missingInst = r.kind === 'guest' && guestsMissingInstrument.has(r.id)}
                    <Table.Row class="max-[640px]:flex max-[640px]:flex-wrap max-[640px]:items-center max-[640px]:gap-y-1 max-[640px]:py-2 {isAdd ? 'opacity-75 focus-within:opacity-100 [&>td]:border-dashed' : ''} {missingInst ? 'bg-destructive/10' : ''}">
                      {#each row.getVisibleCells() as cell (cell.id)}
                        <Table.Cell class="max-[640px]:not-last:border-r-0 max-[640px]:px-2 max-[640px]:py-0 {(cell.column.columnDef.meta as { cell?: string } | undefined)?.cell ?? ''}">
                          <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
                        </Table.Cell>
                      {/each}
                    </Table.Row>
                  {/each}
                </Table.Body>
              </Table.Root>
            </div>

            <div class="flex flex-col gap-3 min-[761px]:flex-row">
              <div class="flex flex-[3] flex-col gap-1.5">
                <Label for="song-editor-comment" class={labelClass}>{$t.song.comment}</Label>
                <Input id="song-editor-comment" value={$draftStore.comment} oninput={e => setField('comment', e.currentTarget.value)} placeholder={$t.song.commentPlaceholder} />
              </div>
              <div class="flex flex-1 flex-col gap-1.5">
                <Label for="song-editor-length" class={labelClass}>{$t.song.length}</Label>
                <Input id="song-editor-length" type="number" min="1" max="99" value={$draftStore.lengthMinutes} oninput={e => setField('lengthMinutes', numberOrNull(e.currentTarget.value) as number)} />
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="lyrics" class="flex min-h-[260px] flex-col pt-2">
            <Textarea
              class="field-sizing-fixed min-h-[220px] flex-1 resize-y overflow-x-auto font-mono text-base leading-[1.55] whitespace-pre md:text-[0.88rem]"
              value={$draftStore.lyrics}
              oninput={e => setField('lyrics', e.currentTarget.value)}
              placeholder={$t.song.lyricsPlaceholder}
              aria-label={$t.song.lyricsTab}
            />
          </Tabs.Content>
        </Tabs.Root>
      </fieldset>
      {/if}
      <div class="flex flex-col gap-1.5">
        <Label for="personal-song-comment" class={labelClass}>{$t.common.personalComment}</Label>
        <Textarea id="personal-song-comment" value={$draftStore.personalComment} oninput={e => setField('personalComment', e.currentTarget.value)} maxlength={4000} rows={3} disabled={$saving} class="field-sizing-fixed resize-y" />
      </div>
      {#if $saveFailed}<p class="text-destructive" role="alert">{$t.common.commentSaveFailed}</p>{/if}
    </div>

    <Dialog.Footer class="shrink-0 flex-row items-center justify-between">
      <div class="flex gap-2">
        {#if ondelete}
          <IconButton icon="🗑" label={$t.song.remove} class="text-muted-foreground hover:border-destructive/40 hover:text-destructive" onclick={() => actions.setConfirm('delete')} />
        {/if}
        {#if onaddtosetlist}
          <IconButton icon="📋" label={$t.addToSetlist.title} onclick={() => { onaddtosetlist!(); closeModal(); }} />
        {/if}
        {#if !personalOnly && mode === 'backlog' && song?.id}
          <IconButton icon={$draftStore.archived ? '📤' : '📦'} label={$draftStore.archived ? $t.song.unarchive : $t.song.archive} onclick={toggleArchive} />
        {/if}
        {#if onremove}
          <Button variant="outline" size="lg" class="text-muted-foreground hover:border-destructive/40 hover:text-destructive" onclick={() => actions.setConfirm('remove')} title={$t.song.removeFromSetlist}>{$t.song.removeFromSetlist}</Button>
        {/if}
      </div>
      <div class="flex gap-2">
        <Button variant="outline" size="lg" onclick={closeModal}>{$t.song.cancel}</Button>
        <Button size="lg" disabled={$saving} onclick={async () => { if (await handleSave()) closeModal(); }}>{$t.song.save}</Button>
      </div>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<AlertDialog.Root open={$confirmKind !== null} onOpenChange={(open) => { if (!open) actions.setConfirm(null); }}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{$confirmKind === 'delete' ? $t.song.remove : $t.song.removeFromSetlist}</AlertDialog.Title>
      <AlertDialog.Description>{$confirmKind === 'delete' ? $t.deleteConfirm : $t.song.removeFromSetlistConfirm}</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>{$t.song.cancel}</AlertDialog.Cancel>
      <AlertDialog.Action
        variant="destructive"
        onclick={() => {
          const kind = $confirmKind;
          actions.setConfirm(null);
          if (kind === 'delete') { ondelete?.(); closeModal(); }
          else if (kind === 'remove') { onremove?.(); closeModal(); }
        }}
      >{$confirmKind === 'delete' ? $t.song.remove : $t.song.removeFromSetlist}</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
