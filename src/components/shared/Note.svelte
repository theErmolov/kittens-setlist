<script lang="ts">
  import { t } from '$lib/i18n';

  let { value = '', label, onsave, preview = false, collapsible = false }: {
    value?: string;
    label: string;
    onsave?: (value: string) => Promise<void>;
    preview?: boolean;
    collapsible?: boolean;
  } = $props();
  let expanded = $state(false);
  let long = $derived(collapsible && (value.length > 240 || value.split('\n').length > 3));
  let editing = $state(false);
  let draft = $state('');
  let saving = $state(false);
  let failed = $state(false);

  async function save() {
    saving = true;
    failed = false;
    try {
      await onsave?.(draft);
      editing = false;
    } catch { failed = true; }
    finally { saving = false; }
  }
</script>

{#if value || onsave || editing}
  <!-- Keep editing notes from triggering row editing, adding, playing, or dragging. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="note" class:preview onclick={(e) => { if (onsave) e.stopPropagation(); }} onkeydown={(e) => { if (onsave) e.stopPropagation(); }} onmousedown={(e) => { if (onsave) e.stopPropagation(); }} ondragstart={(e) => { e.stopPropagation(); e.preventDefault(); }}>
    {#if editing}
      <label>
        <span class="label">{label}</span>
        <textarea bind:value={draft} maxlength="4000" rows="3" disabled={saving}></textarea>
      </label>
      <div class="actions">
        <button disabled={saving} onclick={save}>{saving ? '…' : $t.editor.save}</button>
        <button disabled={saving} onclick={() => { editing = false; failed = false; }}>{$t.editor.cancel}</button>
      </div>
      {#if failed}<span class="error" role="alert">{$t.common.commentSaveFailed}</span>{/if}
    {:else}
      {#if value}<div class="text" class:collapsed={long && !expanded}><span class="label">{label}: </span>{value}</div>{/if}
      {#if long}<button class="edit" aria-expanded={expanded} onclick={(e) => { e.stopPropagation(); expanded = !expanded; }}>{expanded ? $t.common.collapseComment : $t.common.expandComment}</button>{/if}
      {#if onsave}<button class="edit" onclick={() => { draft = value; editing = true; failed = false; }}>{value ? $t.common.edit : $t.common.addComment} · {label}</button>{/if}
    {/if}
  </div>
{/if}

<style>
  .note { margin-top: 5px; font-size: 0.85rem; color: var(--text); min-width: 0; }
  .text { white-space: pre-wrap; overflow-wrap: anywhere; }
  .text .label { margin-right: 4px; }
  .label { color: var(--text-muted); font-size: 0.78rem; }
  .collapsed { display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .preview .text { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  textarea { display: block; width: 100%; box-sizing: border-box; margin: 4px 0; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 5px; padding: 6px; font: inherit; resize: vertical; }
  button { cursor: pointer; background: var(--surface); color: var(--text-muted); border: 1px solid var(--border); border-radius: 4px; padding: 4px 7px; font: inherit; font-size: 0.78rem; }
  button:disabled { opacity: 0.5; cursor: default; }
  .edit { background: transparent; border: none; padding: 2px 0; }
  .actions { display: flex; gap: 6px; }
  .error { color: #ef4444; }
  @media (max-width: 700px) { textarea { font-size: 16px; } }
</style>
