<script lang="ts">
  import type { LearningStage } from '$lib/types';
  import { t } from '$lib/i18n';
  let { value = 'queue', name, disabled = false, onchange }: {
    value?: LearningStage; name: string; disabled?: boolean;
    onchange: (stage: LearningStage) => void;
  } = $props();
  const stages: LearningStage[] = ['queue', 'structure', 'mastering', 'ready'];
  const segments: LearningStage[] = ['structure', 'mastering', 'ready'];
  const colors: Partial<Record<LearningStage, string>> = {
    structure: '#8A000A', mastering: '#856100', ready: '#005909'
  };
</script>
<div class="prog-bar" role="group" aria-label={`${name} · ${$t.song.progress}`} style="--fill: {colors[value] ?? 'var(--border)'}">
  {#each segments as stage}
    <button type="button" class="prog-seg" class:filled={stages.indexOf(value) >= stages.indexOf(stage)}
      {disabled} aria-label={`${name} · ${$t.progress[stage]}`} aria-pressed={value === stage}
      title={$t.progress[stage]} onclick={() => onchange(value === stage ? 'queue' : stage)}></button>
  {/each}
</div>
<style>
  .prog-bar { display: flex; gap: 2px; flex-shrink: 0; }
  .prog-seg { width: 36px; height: 20px; border: none; cursor: pointer; padding: 0; background: var(--border); transition: background .15s; }
  .prog-seg:first-child { border-radius: 5px 0 0 5px; }
  .prog-seg:last-child { border-radius: 0 5px 5px 0; }
  .prog-seg.filled { background: var(--fill); }
  .prog-seg:hover:not(:disabled) { opacity: .75; }
  .prog-seg:disabled { opacity: .5; cursor: default; }
  @media(max-width:600px) { .prog-seg { height: 28px; width: 44px; } }
</style>
