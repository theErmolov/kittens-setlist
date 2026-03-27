---
name: feedback_patterns
description: Preferences and key decisions made during development
type: feedback
---

**Use `browser` from `$app/environment` for any localStorage access.**
Why: SvelteKit SSR makes `localStorage` exist but throws on `.getItem()`. `typeof localStorage === 'undefined'` doesn't catch it.
How to apply: Always `if (!browser) return fallback` before touching localStorage.

**Don't summarise what you just did at the end of responses.**
Why: User can read the diff.

**Never commit or push unless explicitly told to in the current message.**
Why: User wants full control over when code leaves local. "commit and push" from a previous session does not carry over.
How to apply: Only run `git commit` or `git push` when the user says so in the current conversation turn.

**Bump the relevant `DATA_VERSION` / `MUSICIANS_VERSION` when store data shape changes.**
Why: Old localStorage data will break new code silently otherwise.

**Category labels in Russian are band-specific slang — don't normalise them.**
- top → "💩 По говну"
- mid → "🎵 Середняк"
- low → "🧪 Андеграунд"

**Instrument filter when musicians are also selected must be scoped to those musicians.**
Why: "Маша + 🎻" means songs where Маша plays violin, not songs where anyone plays violin.
How to apply: See filter logic in `SongTable.svelte`.

**Musicians cannot be removed from a song — only their instrument can be cleared.**
Why: User explicitly removed the include/exclude toggle. All band members are always present in every song record.
How to apply: No "remove from song" UI. Instrument buttons are the only per-musician control.

**Each musician has exactly one default instrument (not a list).**
Why: User said "musician can play only 1 instrument". The old `defaultInstruments: Instrument[]` was replaced with `defaultInstrument?: Instrument`.
How to apply: `BandMusician.defaultInstrument` is a single optional value.


**SvelteKit does NOT automatically prepend `paths.base` to `href` attributes — must be done manually.**
Why: Discovered when deploying to GitHub Pages at `/kittens-setlist/` — all links skipped the base and 404'd.
How to apply: Import `base` from `$app/paths` and write `href="{base}/route"` in every Svelte file that has absolute hrefs. Also prefix `redirect()` calls: `redirect(302, \`${base}/route\`)`. `goto()` IS base-aware and needs no change.
