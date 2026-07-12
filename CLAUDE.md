# Музыкальные Котятки — Setlist App

Band setlist manager. SvelteKit SPA + AWS Lambda + DynamoDB.

## 🚨 Hard rules — no exceptions

- **NEVER run `git commit`, `git push`, `sam build`, `sam deploy`, or any deployment command** unless the user's current message explicitly asks for it (e.g. "commit", "push", "commit and push"). Do not do it as a follow-up step after finishing code changes.
- Deployment is always through **commit → push → CI/CD**. Never invoke `sam deploy` directly.

## Memory

Read at the start of every session:
- `.claude/memory/project.md` — current state, what's built, what's next
- `.claude/memory/feedback.md` — preferences, gotchas, decisions

## Tech Stack

- **Svelte 5** runes mode — `$state`, `$derived`, `$effect` everywhere, **no `$:`**
- **SvelteKit** `@sveltejs/adapter-static` (SPA, `fallback: '200.html'`)
- **AWS Lambda** (Node 22, arm64) + API Gateway + DynamoDB (5 tables)
- API URL: `https://bw1e6cey18.execute-api.eu-central-1.amazonaws.com/prod`
- Deploy: `sam build && sam deploy --profile personal --parameter-overrides TelegramBotToken=... SuperadminTelegramId=...`
- **No CSS framework** — plain scoped styles + CSS custom properties
- **Always use `browser` from `$app/environment`** to guard any `localStorage` access

## Local dev setup

`.env` is gitignored and must be created manually on each new machine:
```
PUBLIC_API_URL=https://bw1e6cey18.execute-api.eu-central-1.amazonaws.com/prod
```

Then `npm install && npm run dev`.

## Local dev auth

Telegram widget only works on `kittens.band`. Workaround:
1. Log in on `kittens.band` → DevTools → Local Storage → copy `auth_token`
2. Paste it into `localhost:5173` Local Storage, reload

Token lasts 180 days.

## Base path gotcha

`paths.base` comes from `BASE_PATH` env var (empty for local/CloudFront, `/kittens-setlist` for GitHub Pages).
- `href` attributes **must** use `import { base } from '$app/paths'` + `href="{base}/route"`
- `goto()` is base-aware; `redirect()` is not — use `` `${base}/route` ``

## Emoji — MANDATORY RULE

All emoji render as Google Noto Color Emoji SVGs (self-hosted in `static/emoji/`, named by Unicode codepoint e.g. `1f3b8.svg`). A `MutationObserver` in `+layout.svelte` uses `@twemoji/api` to replace emoji text with `<img>` tags pointing to local SVGs.

**Every emoji used anywhere in the UI must have its SVG pre-downloaded. Missing SVGs produce 404s. Whenever you add or change an emoji in any `.svelte` or `.ts` file, run this immediately:**

```bash
curl -o static/emoji/{codepoint}.svg \
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/svg/emoji_u{codepoint}.svg"
```

Find the codepoint from the emoji character (e.g. `U+1F3B8` → `1f3b8`). Drop variation selectors (`U+FE0F`).

## Non-obvious design decisions

- **Song snapshots** — `entry.song` is a full copy frozen at add time; backlog edits never propagate to setlist entries
- **Guest musicians** — not pre-registered; typed inline in the song edit modal; stored as extra keys in `song.musicians` whose names don't match any `BandMusician`
- **Backlog filter** — Musicians filter is AND (all selected must appear); Instruments filter is OR but scoped: if musicians selected → only their instruments count, otherwise any musician's
- **Breaks** — stored as `SetlistEntry` with `breakMinutes` set and no `songId`; hidden in setlist editor while musician filter is active
- **Setlist polling** — smart merge skips no-ops and protects drag state (3 s); stage polling skips update if entries are identical (2 s)
- **Category labels** — `top`=💩 По говну, `mid`=🎵 Середняк, `low`=🧪 Андеграунд
- **Add-to-setlist flow** (`SongTable`/`SongRow`) — only "open" setlists are offered (`isSetlistOpen`: not more than 24h past `date`+`startTime`; no date = always open). Exactly 1 open setlist → auto-add, no popup; 0 or >1 → picker popup. Adding is idempotent (skips if song already in setlist) but always plays a 1 s green checkmark flash on the row (`.add-flash`). Picker is add-only (no toggle/remove). Mobile has a togglable "📋 В сетлист" mode in the bottom bar (row tap adds instead of edits); desktop uses the per-row 📋 button. Mobile Progress toggle lives inside the filter panel.
- **Setlist subsets ("сеты")** — `Setlist.subsets?: SetlistSubset[]` + `SetlistEntry.subsetId?`, edited only in `SetlistEditor.svelte` (stage view is display-only). **Invariant the editor must maintain on every mutation**: entries with a `subsetId` sit contiguously at the top of `entries`, grouped in `subsets[]` order, followed by the unassigned pool — `order` is renumbered 0..N every time via `rebuildEntries()`. Nothing else (stage view, `unplayedToBottom`, played-marking) needs to know about subsets because physical order already encodes the grouping. "Quick-set mode" (`activeSubsetId` state): tapping a song row toggles it in/out of the active subset instead of editing; dragging is disabled while active. Adding a song auto-sorts the subset via `sortSubset()` (`src/lib/subsetSort.ts`) unless `subset.manualSort` is set (flips true once the user drags within a subset). The sort minimizes instrument changes across musicians (vocals excluded) chained off up to 2 anchor songs — the previous subset's tail, or the most recently played songs for the first subset.

## Key files

- `src/lib/types.ts` — full data model (Song, Setlist, SetlistEntry, BandMusician…)
- `src/lib/api.ts` — all API calls; Bearer token auto-injected
- `src/lib/auth.ts` — `currentUser` store, auth guard, Telegram login
- `src/lib/i18n.ts` — `$t.section.key`, `'ru'` default, `ruPlural()` helper
