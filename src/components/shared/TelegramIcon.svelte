<script lang="ts">
  /** The Telegram logo: a blue gradient disc with the white paper plane. */
  let { class: className = 'size-4' }: { class?: string } = $props();
  const id = $props.id();
</script>

<svg viewBox="0 0 24 24" class={className} aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="{id}-tg" x1="12" y1="0" x2="12" y2="24" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#37aee2" />
      <stop offset="1" stop-color="#1e96c8" />
    </linearGradient>
  </defs>
  <circle cx="12" cy="12" r="12" fill="url(#{id}-tg)" />
  <path
    fill="#fff"
    transform="translate(4.3 4.6) scale(0.68)"
    d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.4 16.18l-1.99 1.93c-.23.23-.42.42-.83.42z"
  />
</svg>
