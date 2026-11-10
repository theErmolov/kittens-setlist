<script lang="ts">
  import { t } from '$lib/i18n';
  import { useStore } from '$lib/store/bridge';
  import { backlogStore } from '$lib/store/backlog';
  const showProgress = useStore(backlogStore, s => s.showProgress);
</script>

<span class="sr-only">{$showProgress ? $t.backlog.progress : $t.backlog.cols.cat}</span>
