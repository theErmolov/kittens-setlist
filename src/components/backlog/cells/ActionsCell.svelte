<script lang="ts">
  import type { Song } from '$lib/types';
  import { t } from '$lib/i18n';
  import { canWrite } from '$lib/auth';
  import RowActions from '$components/shared/RowActions.svelte';
  import ButtonRow from '$components/shared/ButtonRow.svelte';
  import { songActions } from '../songActions';

  let { song }: { song: Song } = $props();
</script>

<!-- Mid and up: the ⋯ button fills the whole cell height, so rows of any height leave no gaps between buttons. -->
<ButtonRow justify="end" class="min-mid:h-full">
  <RowActions drawer class="min-mid:h-full min-mid:rounded-none" actions={songActions(song, $t, $canWrite)} />
</ButtonRow>
