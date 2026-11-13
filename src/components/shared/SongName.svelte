<script lang="ts">
  /**
   * The app-wide song name format: «Artist – Title» (artist regular, muted dash, title semibold) in one run of text.
   * `class` styles the wrapper (truncate / wrap); `strike` (e.g. `line-through`) is applied to every part (played songs).
   */
  import { cn } from '$lib/utils';

  let { artist, title, class: className, strike, titleClass }: {
    artist: string;
    title: string;
    class?: string;
    strike?: string;
    /** Extra classes of the title part (e.g. the `title` hook class). */
    titleClass?: string;
  } = $props();
</script>

<span class={cn('min-w-0', className)} title="{artist} – {title}">
  <span class={cn('text-lead font-normal', strike)}>{artist}</span>
  <span class={cn('mx-1 text-muted-foreground', strike)}>–</span>
  <span class={cn('text-lead font-semibold', titleClass, strike)}>{title}</span>
</span>
