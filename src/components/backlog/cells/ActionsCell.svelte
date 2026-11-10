<script lang="ts">
  import type { Song } from '$lib/types';
  import { t } from '$lib/i18n';
  import { canWrite } from '$lib/auth';
  import RowActions from '$components/shared/RowActions.svelte';
  import ButtonRow from '$components/shared/ButtonRow.svelte';
  import { songActions } from '../songActions';

  let { song }: { song: Song } = $props();
</script>

<ButtonRow justify="end">
  <RowActions actions={songActions(song, $t, $canWrite)} />
</ButtonRow>
