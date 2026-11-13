import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

// Colours live in src/app.css only (palette + context tokens, both themes). Components use the Tailwind utilities generated from those tokens
// (`bg-success-soft`, `text-vibe-on-ink`, `tint-break-bg` …) — never a hex / rgb() / hsl() literal.
// SVG artwork that cannot take CSS variables is allow-listed below.
const ROOT = new URL('../src/', import.meta.url).pathname;
const ALLOWED = new Set(['components/shared/LogoCat.svelte', 'components/shared/TelegramIcon.svelte']);
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch)\(/;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(svelte|ts)$/.test(name)) yield path;
  }
}

test('no hard-coded colour literals outside src/app.css', () => {
  const offenders = [];
  for (const file of files(ROOT)) {
    const rel = relative(ROOT, file);
    if (ALLOWED.has(rel)) continue;
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (LITERAL.test(line)) offenders.push(`src/${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
  assert.deepEqual(offenders, [], `Use a colour token from src/app.css (add it in BOTH themes if it is new):\n${offenders.join('\n')}`);
});
