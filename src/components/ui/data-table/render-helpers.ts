import type { Component, ComponentProps, Snippet } from 'svelte';

/** Marks a column cell/header as "render this Svelte component with these props" (used by FlexRender). */
export class RenderComponentConfig<TComponent extends Component> {
  constructor(public component: TComponent, public props: ComponentProps<TComponent> | Record<string, never>) {}
}

/** Marks a column cell/header as "render this snippet with these params". */
export class RenderSnippetConfig<TProps> {
  constructor(public snippet: Snippet<[TProps]>, public params: TProps) {}
}

export function renderComponent<TComponent extends Component, TProps extends ComponentProps<TComponent>>(
  component: TComponent,
  props: TProps = {} as TProps,
) {
  return new RenderComponentConfig(component, props);
}

export function renderSnippet<TProps>(snippet: Snippet<[TProps]>, params: TProps = {} as TProps) {
  return new RenderSnippetConfig(snippet, params);
}
