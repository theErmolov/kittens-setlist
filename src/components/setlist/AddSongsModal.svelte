<script lang="ts">
  import type { Song, Category } from '$lib/types';
  import FilterChips from '$components/shared/FilterChips.svelte';
  import { Label } from '$components/ui/label';
  import CategoryBadge from '$components/shared/CategoryBadge.svelte';
  import * as Dialog from '$components/ui/dialog';
  import { Button } from '$components/ui/button';
  import { Input } from '$components/ui/input';
  import { Checkbox } from '$components/ui/checkbox';
  import { ScrollArea } from '$components/ui/scroll-area';
  import * as Item from '$components/ui/item';
  import * as Empty from '$components/ui/empty';
  import { mobileFullscreen } from './dialogClasses';
  import { t } from '$lib/i18n';
  import { useStore } from '$lib/store/bridge';
  import { addSongsStore } from '$lib/store/stage';

  let {
    songs,
    existingIds,
    onclose,
    onadd,
    onaddnew,
  }: {
    songs: Song[];
    existingIds: Set<string>;
    onclose: () => void;
    onadd: (songs: Song[]) => void;
    onaddnew?: () => void;
  } = $props();

  addSongsStore.getState().reset();
  const search = useStore(addSongsStore, s => s.search);
  const categoryFilter = useStore(addSongsStore, s => s.categoryFilter);
  const selected = useStore(addSongsStore, s => s.selected);
  const { setSearch, setCategoryFilter, toggle } = addSongsStore.getState();

  let filtered = $derived(songs
    .filter(s => {
      if (existingIds.has(s.id)) return false;
      if (s.archived) return false;
      if ($categoryFilter.size > 0 && !$categoryFilter.has(s.category)) return false;
      const q = $search.toLowerCase();
      return !q || s.artist.toLowerCase().includes(q) || s.title.toLowerCase().includes(q);
    })
    .sort((a, b) => a.artist.localeCompare(b.artist, undefined, { sensitivity: 'base' })));

  function handleAdd() { onadd([...$selected.values()]); }

</script>

<Dialog.Root open onOpenChange={o => { if (!o) onclose(); }}>
  <Dialog.Content showCloseButton class="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px] {mobileFullscreen}">
    <Dialog.Header class="shrink-0 border-b px-[18px] py-3.5">
      <Dialog.Title class="text-[1.05rem] font-bold">{$t.addSongs.title}</Dialog.Title>
    </Dialog.Header>
    <div class="shrink-0 border-b px-[18px] py-2.5">
      <Input class="bg-background" value={$search} oninput={e => setSearch(e.currentTarget.value)} placeholder={$t.addSongs.search} aria-label={$t.addSongs.search} />
    </div>
    <div class="shrink-0 border-b px-[18px] py-2">
      <FilterChips selected={$categoryFilter} onchange={setCategoryFilter} />
    </div>
    <ScrollArea class="min-h-[240px] flex-1 basis-0 py-2">
      {#each filtered as song (song.id)}
        <Item.Root class="rounded-none border-0 p-0 hover:bg-(--row-hover) {$selected.has(song.id) ? 'bg-(--row-hover)' : ''}">
          <Label for="add-song-{song.id}" class="w-full cursor-pointer gap-2.5 px-[18px] py-[9px] font-normal">
            <Checkbox id="add-song-{song.id}" checked={$selected.has(song.id)} onCheckedChange={() => toggle(song)} />
            <Item.Content class="flex-row items-center gap-1.5">
              <CategoryBadge category={song.category} iconOnly />
              <Item.Title class="text-[0.88rem] font-normal">{song.artist} – {song.title}</Item.Title>
            </Item.Content>
          </Label>
        </Item.Root>
      {/each}
      {#if filtered.length === 0}
        <Empty.Root class="border-0 p-6">
          <Empty.Header><Empty.Title class="text-sm font-normal text-muted-foreground">{$t.addSongs.empty}</Empty.Title></Empty.Header>
        </Empty.Root>
      {/if}
    </ScrollArea>
    <Dialog.Footer class="m-0 shrink-0 flex-row flex-wrap items-center gap-2 px-[18px] py-3">
      {#if onaddnew}
        <Button variant="outline" class="w-full justify-start sm:hidden" onclick={onaddnew}>{$t.editor.addSetlistOnly}</Button>
      {/if}
      <span class="flex-1 text-[0.82rem] text-muted-foreground">{$t.addSongs.selected($selected.size)}</span>
      <Button variant="outline" onclick={onclose}>{$t.addSongs.cancel}</Button>
      <Button class="font-semibold" onclick={handleAdd} disabled={$selected.size === 0}>
        {$t.addSongs.addBtn($selected.size)}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
