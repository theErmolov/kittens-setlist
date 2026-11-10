<script lang="ts">
  /** Vertical rule between a page bar's breadcrumb and its controls (use inside the `start`/`end` snippets of PageControls). */
  import * as NavigationMenu from '$components/ui/navigation-menu';
  import { Separator } from '$components/ui/separator';
</script>

<NavigationMenu.Item class="flex items-center self-stretch py-2.5">
  <Separator orientation="vertical" />
</NavigationMenu.Item>
