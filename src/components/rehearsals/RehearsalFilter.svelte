<script lang="ts">
  /**
   * Song filter palette of the rehearsal detail page (shadcn Command, same pattern as the backlog filter):
   * «Sorting» (least ready first) and «Participants» (AND filter of the song rows). Toggling keeps it open.
   */
  import { t } from '$lib/i18n';
  import { rehearsalText as rt } from '$lib/rehearsalI18n';
  import { useStore } from '$lib/store/bridge';
  import { rehearsalDetailStore as detail } from '$lib/store/rehearsals';
  import * as Command from '$components/ui/command';

  let { names, counts, shown, total }: { names: string[]; counts: Record<string, number>; shown: number; total: number } = $props();
  const participantFilter = useStore(detail, s => s.participantFilter);
  const readinessFirst = useStore(detail, s => s.readinessFirst);
  const actions = detail.getState();
  const activeCount = $derived($participantFilter.length + ($readinessFirst ? 1 : 0));
</script>

<Command.Root class="h-auto min-h-0 p-0">
  <Command.Input placeholder={$rt.filterParticipants} aria-label={$rt.filterParticipants} />
  <Command.List class="max-h-[min(360px,36dvh)]">
    <Command.Group heading={$rt.filterSort}>
      <Command.Item value={$rt.leastReadyFirst} data-checked={$readinessFirst} onSelect={() => actions.patch({ readinessFirst: !$readinessFirst })}>
        <span aria-hidden="true">📉</span><span>{$rt.leastReadyFirst}</span>
      </Command.Item>
    </Command.Group>
    <Command.Group heading={$rt.filterParticipants}>
      {#each names as name (name)}
        <Command.Item value={name} data-checked={$participantFilter.includes(name)} onSelect={() => actions.toggleParticipant(name)}>
          <span>{name}</span>
          <span class="text-xs text-muted-foreground">{counts[name] ?? 0}</span>
        </Command.Item>
      {/each}
    </Command.Group>
  </Command.List>
  <Command.Separator />
  <Command.Group forceMount>
    <Command.Item value="__reset" forceMount disabled={activeCount === 0} onSelect={() => actions.resetFilters()}>{$t.backlog.filterReset}</Command.Item>
  </Command.Group>
  <p class="px-3 pb-2 text-xs text-muted-foreground" aria-live="polite">{$rt.filterResult.replace('{n}', String(shown)).replace('{m}', String(total))}</p>
</Command.Root>
