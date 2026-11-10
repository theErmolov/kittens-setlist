<script lang="ts">
  /**
   * Learning-stage picker: a shadcn ButtonGroup of three plain segments (structure / mastering / ready), no icons.
   * Cumulative highlight: stage 1 = segment 1 red; stage 2 = segments 1-2 orange; stage 3 = all three green.
   * Hovering a segment previews that result (segments after it show empty). Pressing the stage already set resets to 'queue'.
   */
  import type { LearningStage } from '$lib/types';
  import { t } from '$lib/i18n';
  import * as ButtonGroup from '$components/ui/button-group';
  import IconButton from '$components/shared/IconButton.svelte';

  let { value = 'queue', name, disabled = false, onchange }: {
    value?: LearningStage; name: string; disabled?: boolean;
    onchange: (stage: LearningStage) => void;
  } = $props();
  const stages: LearningStage[] = ['queue', 'structure', 'mastering', 'ready'];
  const segments: LearningStage[] = ['structure', 'mastering', 'ready'];
  const fills: Partial<Record<LearningStage, string>> = {
    structure: 'border-danger-ink/40 bg-danger hover:bg-danger',
    mastering: 'border-warning-ink/40 bg-warning hover:bg-warning',
    ready: 'border-success-ink/40 bg-success hover:bg-success',
  };
  const filled = (stage: LearningStage) => value !== 'queue' && stages.indexOf(value) >= stages.indexOf(stage);

  // Hover preview (pure CSS, no state): hovering a segment fills it and every segment before it with its tone; later segments show empty.
  // `group-has-[[data-stage=x]:hover]/pg` = "this group currently contains the hovered segment of stage x". Classes are written out in full so Tailwind can see them.
  const preview: Record<string, string> = {
    structure:
      'group-has-[[data-stage=structure]:hover:not(:disabled)]/pg:border-danger-ink/40 group-has-[[data-stage=structure]:hover:not(:disabled)]/pg:bg-danger ' +
      'group-has-[[data-stage=mastering]:hover:not(:disabled)]/pg:border-warning-ink/40 group-has-[[data-stage=mastering]:hover:not(:disabled)]/pg:bg-warning ' +
      'group-has-[[data-stage=ready]:hover:not(:disabled)]/pg:border-success-ink/40 group-has-[[data-stage=ready]:hover:not(:disabled)]/pg:bg-success',
    mastering:
      'group-has-[[data-stage=structure]:hover:not(:disabled)]/pg:border-border group-has-[[data-stage=structure]:hover:not(:disabled)]/pg:bg-background ' +
      'group-has-[[data-stage=mastering]:hover:not(:disabled)]/pg:border-warning-ink/40 group-has-[[data-stage=mastering]:hover:not(:disabled)]/pg:bg-warning ' +
      'group-has-[[data-stage=ready]:hover:not(:disabled)]/pg:border-success-ink/40 group-has-[[data-stage=ready]:hover:not(:disabled)]/pg:bg-success',
    ready:
      'group-has-[[data-stage=structure]:hover:not(:disabled)]/pg:border-border group-has-[[data-stage=structure]:hover:not(:disabled)]/pg:bg-background ' +
      'group-has-[[data-stage=mastering]:hover:not(:disabled)]/pg:border-border group-has-[[data-stage=mastering]:hover:not(:disabled)]/pg:bg-background ' +
      'group-has-[[data-stage=ready]:hover:not(:disabled)]/pg:border-success-ink/40 group-has-[[data-stage=ready]:hover:not(:disabled)]/pg:bg-success',
  };
</script>

<ButtonGroup.Root class="group/pg shrink-0" aria-label={`${name} · ${$t.song.progress}`}>
  {#each segments as stage (stage)}
    <IconButton
      icon=""
      data-stage={stage}
      label={`${name} · ${$t.progress[stage].replace(/^\S+\s/, '')}`}
      {disabled}
      class="w-12 {filled(stage) ? fills[value] : ''} {preview[stage]}"
      onclick={() => onchange(value === stage ? 'queue' : stage)}
    />
  {/each}
</ButtonGroup.Root>
