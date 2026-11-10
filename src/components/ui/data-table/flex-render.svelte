<script lang="ts" generics="TContext extends Record<string, any>">
  import type { CellContext, ColumnDefTemplate, HeaderContext } from '@tanstack/table-core';
  import { RenderComponentConfig, RenderSnippetConfig } from './render-helpers.js';

  type Props = {
    /** A column's `header` / `cell` / `footer` definition. */
    content?: ColumnDefTemplate<HeaderContext<any, any>> | ColumnDefTemplate<CellContext<any, any>> | undefined;
    context: TContext;
  };

  let { content, context }: Props = $props();
</script>

{#if typeof content === 'string'}
  {content}
{:else if content instanceof Function}
  {@const result = content(context as any)}
  {#if result instanceof RenderComponentConfig}
    {@const Component = result.component}
    <Component {...result.props} />
  {:else if result instanceof RenderSnippetConfig}
    {@render result.snippet(result.params)}
  {:else}
    {result}
  {/if}
{/if}
