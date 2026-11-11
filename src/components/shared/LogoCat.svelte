<script lang="ts">
  import { t } from '$lib/i18n';
  let { size = 36 }: { size?: number } = $props();
</script>

<svg
  width={(size * 34) / 40}
  height={size}
  viewBox="3 0 34 40"
  xmlns="http://www.w3.org/2000/svg"
  aria-label={$t.common.bandName}
>
  <!-- Left ear -->
  <polygon points="6,19 3,5 15,15" fill="var(--accent)"/>
  <polygon points="7.5,17.5 6,9 13,14" fill="color-mix(in srgb, var(--accent) 55%, white)"/>
  <!-- Right ear -->
  <polygon points="34,19 37,5 25,15" fill="var(--accent)"/>
  <polygon points="32.5,17.5 34,9 27,14" fill="var(--primary-foreground)" opacity="0.55"/>
  <!-- Head -->
  <circle cx="20" cy="23" r="15" fill="var(--accent)"/>
  <!-- Left eye -->
  <ellipse cx="14.5" cy="20.5" rx="2.8" ry="2.2" fill="white"/>
  <circle cx="15" cy="20.8" r="1.4" fill="#1a1d26"/>
  <circle cx="15.5" cy="20.2" r="0.5" fill="white"/>
  <!-- Right eye -->
  <ellipse cx="25.5" cy="20.5" rx="2.8" ry="2.2" fill="white"/>
  <circle cx="26" cy="20.8" r="1.4" fill="#1a1d26"/>
  <circle cx="26.5" cy="20.2" r="0.5" fill="white"/>
  <!-- Nose -->
  <ellipse cx="20" cy="25.5" rx="1.6" ry="1.1" fill="var(--primary-foreground)"/>
  <!-- Mouth -->
  <path d="M18.5 26.8 Q20 28.5 21.5 26.8" stroke="var(--primary-foreground)" stroke-width="0.9" fill="none" opacity="0.8"/>
  <!-- Whiskers left -->
  <line x1="4" y1="24.5" x2="15" y2="25.5" stroke="var(--primary-foreground)" stroke-width="0.8" opacity="0.45"/>
  <line x1="4" y1="27.5" x2="15" y2="27" stroke="var(--primary-foreground)" stroke-width="0.8" opacity="0.45"/>
  <!-- Whiskers right -->
  <line x1="36" y1="24.5" x2="25" y2="25.5" stroke="var(--primary-foreground)" stroke-width="0.8" opacity="0.45"/>
  <line x1="36" y1="27.5" x2="25" y2="27" stroke="var(--primary-foreground)" stroke-width="0.8" opacity="0.45"/>
  <!-- Musical note (♪) as path -->
  <g transform="translate(17, 32) scale(0.6)" fill="var(--primary-foreground)" opacity="0.9">
    <rect x="4" y="0" width="1.8" height="8" rx="0.8"/>
    <rect x="4" y="0" width="7" height="1.8" rx="0.8"/>
    <rect x="9.2" y="0" width="1.8" height="5" rx="0.8"/>
    <ellipse cx="3.5" cy="9.5" rx="2.8" ry="2" transform="rotate(-12, 3.5, 9.5)" />
    <ellipse cx="9.5" cy="6.5" rx="2.8" ry="2" transform="rotate(-12, 9.5, 6.5)" />
  </g>
</svg>

<style>
  svg { display: block; flex-shrink: 0; }
</style>
