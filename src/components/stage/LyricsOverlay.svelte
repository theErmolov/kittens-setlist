<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import type { Song } from '$lib/types';

  let { song, onclose }: { song: Song; onclose: () => void } = $props();

  // A chord token: root note + optional accidental + optional quality/extension + optional bass
  // Examples: Am, G, Cmaj7, F#m, Bb7, Dsus4, E/B, Gmaj9
  const CHORD_TOKEN = /^[A-G][b#]?(?:m(?:aj\d*)?|sus[24]?|aug|dim|\d+(?:add\d+)?)*(?:\/[A-G][b#]?)?$/;

  function isChordLine(line: string): boolean {
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    return tokens.length > 0 && tokens.every(t => CHORD_TOKEN.test(t));
  }

  let lines = $derived((song.lyrics ?? '').split('\n'));

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }

  onMount(() => {
    if (browser) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeydown);
    }
  });

  onDestroy(() => {
    if (browser) {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeydown);
    }
  });
</script>

<div class="overlay">
  <div class="overlay-header">
    <button class="close-btn" onclick={onclose}>✕</button>
    <div class="song-info">
      <span class="song-title">{song.title}</span>
      <span class="song-artist">{song.artist}</span>
    </div>
  </div>
  <div class="lyrics-body">
    <div class="lyrics-pre">
      {#each lines as line}
        <span class="line" class:chord-line={isChordLine(line)}>{line || ' '}</span>
      {/each}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: var(--bg);
    display: flex;
    flex-direction: column;
  }

  .overlay-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.1rem;
    color: var(--text-muted);
    padding: 4px 8px;
    flex-shrink: 0;
    line-height: 1;
  }
  .close-btn:hover { color: var(--text); }

  .song-info {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }
  .song-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .song-artist {
    font-size: 0.85rem;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .lyrics-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }

  .lyrics-pre {
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.92rem;
    line-height: 1.6;
    color: var(--text);
  }

  .line {
    display: block;
    white-space: pre;
    min-height: 1.6em;
  }

  .chord-line {
    color: #60a5fa;
    font-weight: bold;
  }

  :global([data-theme="light"]) .chord-line {
    color: #e8305a;
  }
</style>
