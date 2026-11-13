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
  // A filled segment is the stage's solid colour with a card-coloured seam; `stage-*-solid` come from app.css.
  const fills: Partial<Record<LearningStage, string>> = {
    structure: 'border-card bg-stage-structure-solid hover:bg-stage-structure-solid',
    mastering: 'border-card bg-stage-mastering-solid hover:bg-stage-mastering-solid',
    ready: 'border-card bg-stage-ready-solid hover:bg-stage-ready-solid',
  };
  const filled = (stage: LearningStage) => value !== 'queue' && stages.indexOf(value) >= stages.indexOf(stage);

  // Hover preview (pure CSS, no state): pointing at a segment shows the result of clicking it — that segment and every one before it in its tone, the rest empty.
  // `over-<stage>:` (a variant defined in app.css) = "the group currently contains the hovered, enabled segment of that stage". Classes are written out in full so Tailwind can see them.
  const solid = (stage: LearningStage) => ({
    structure: 'over-structure:border-card over-structure:bg-stage-structure-solid',
    mastering: 'over-mastering:border-card over-mastering:bg-stage-mastering-solid',
    ready: 'over-ready:border-card over-ready:bg-stage-ready-solid',
  })[stage as 'structure' | 'mastering' | 'ready'];
  const empty = (stage: LearningStage) => ({
    structure: 'over-structure:border-border over-structure:bg-background',
    mastering: 'over-mastering:border-border over-mastering:bg-background',
    ready: 'over-ready:border-border over-ready:bg-background',
  })[stage as 'structure' | 'mastering' | 'ready'];
  const preview = (seg: LearningStage) => segments.map(h => segments.indexOf(seg) <= segments.indexOf(h) ? solid(h) : empty(h)).join(' ');
</script>

<ButtonGroup.Root data-stage-group class="shrink-0" aria-label={`${name} · ${$t.song.progress}`}>
  {#each segments as stage (stage)}
    <IconButton
      icon=""
      data-stage={stage}
      label={`${name} · ${$t.progress[stage].replace(/^\S+\s/, '')}`}
      {disabled}
      class="h-8.5 min-h-8.5 w-12 {filled(stage) ? fills[value] : ''} {preview(stage)}"
      onclick={() => onchange(value === stage ? 'queue' : stage)}
    />
  {/each}
</ButtonGroup.Root>
