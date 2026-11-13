<script lang="ts">
  import { Switch } from '$components/ui/switch';
  import { Label } from '$components/ui/label';
  import { t } from '$lib/i18n';

  // "Vibe" toggle with its "?" tooltip, shared by the new-setlist and edit-setlist dialogs.
  let { id, checked, onchange }: { id: string; checked: boolean; onchange: (v: boolean) => void } = $props();
</script>

<div class="flex items-center gap-2">
  <Switch {id} size="sm" {checked} onCheckedChange={onchange} />
  <Label for={id} class="text-body font-normal text-muted-foreground">{$t.setlists.vibe}</Label>
  <span class="inline-flex size-4 shrink-0 cursor-default items-center justify-center rounded-full border text-tiny leading-none text-muted-foreground" title={$t.setlists.vibeTooltip}>?</span>
</div>
