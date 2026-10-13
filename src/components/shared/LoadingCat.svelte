<script lang="ts">
  import LogoCat from './LogoCat.svelte';
  import { lang } from '$lib/i18n';
</script>

<span class="loading-cat" role="status" aria-label={$lang === 'ru' ? 'Загрузка' : 'Loading'}>
  <span class="spinner" aria-hidden="true"><LogoCat size={40} /></span>
</span>

<style>
  .loading-cat { display: inline-flex; vertical-align: middle; }
  .spinner { display: block; animation: spin 1.5s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .spinner { animation: none; }
  }
</style>
