<script lang="ts">
  /** Search box of the filter bars: `label` is both the placeholder and the accessible name. */
  import { Input } from '$components/ui/input';

  let { label, value, onchange, class: className }: {
    label: string;
    value: string;
    onchange: (value: string) => void;
    class?: string;
  } = $props();
</script>

<Input class={className} type="search" placeholder={label} aria-label={label} {value} oninput={e => onchange(e.currentTarget.value)} />
