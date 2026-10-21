<script lang="ts">
  let { artist, title, dimmed = false }: { artist: string; title: string; dimmed?: boolean } = $props();
</script>

<span class="song-name" class:dimmed><span class="artist">{artist}</span><span class="sep">–</span><strong>{title}</strong></span>

<style>
  .song-name { font-size: 1.08rem; line-height: 1.35; color: var(--text); overflow-wrap: anywhere; }
  .artist { font-weight: 400; }
  .sep { margin: 0 4px; color: var(--text-muted); }
  strong { font-weight: 600; }
  .dimmed { color: var(--text-muted); }
</style>
