# Музыкальные Котятки — Setlist App

Band setlist manager for "Музыкальные Котятки". Replaces a Google Sheet.
Full stack: SvelteKit frontend + AWS Lambda + DynamoDB backend.

## Memory

Read these files at the start of every session:
- `.claude/memory/project.md` — current state, what's built, what's next
- `.claude/memory/feedback.md` — preferences, gotchas, decisions

## Tech Stack

- **Svelte 5** (runes mode — `$state`, `$derived`, `$effect` everywhere, no `$:`)
- **SvelteKit** with `@sveltejs/adapter-static` (SPA mode, `fallback: '200.html'`)
- **AWS Lambda** (Node 22, arm64) + **API Gateway HTTP API** + **DynamoDB** (5 tables)
- API URL: `https://bw1e6cey18.execute-api.eu-central-1.amazonaws.com/prod`
- Deploy: `sam build && sam deploy --profile personal --parameter-overrides TelegramBotToken=... SuperadminTelegramId=...` (SAM stack `kittens-setlist`, `eu-central-1`)
- **TypeScript** strict mode
- **No CSS framework** — plain scoped styles + CSS custom properties

## Local dev + auth

The Telegram Login Widget only works on `kittens.band` (registered domain), so you can't log in via the widget on localhost. The workaround — copy your session token from prod:

1. Log in on `kittens.band` → DevTools → Application → Local Storage → copy `auth_token`
2. Open `localhost:5173` → DevTools → Application → Local Storage → set `auth_token` to that value
3. Reload — local dev now hits the prod API as an authenticated user

The token is valid for 180 days so this only needs doing occasionally.

## Architecture

### Base path / GitHub Pages
- `paths.base` in `svelte.config.js` is set from `process.env.BASE_PATH` (empty for local/CloudFront, `/kittens-setlist` for GitHub Pages)
- SvelteKit does **not** auto-prepend `base` to `href` attributes — every Svelte file with absolute hrefs must `import { base } from '$app/paths'` and use `href="{base}/route"`
- `goto()` is base-aware (no change needed); `redirect()` is not — use `` `${base}/route` ``

### Auth — `src/lib/auth.ts`
- `currentUser` store (`KittensUser | null`), populated on init by hitting `GET /auth/me` with token from localStorage
- Auth guard in `+layout.svelte` `$effect`: redirects to `/login` unless on `/login` or a `/stage` route
- Telegram Login Widget on `/login` page — bot `@kittens_control_center_bot`, `PUBLIC_TELEGRAM_BOT_USERNAME` env var
- New users → `pending` until superadmin approves via `/admin`; superadmin ID from `SUPERADMIN_TELEGRAM_ID` Lambda env var (GitHub secret)
- All API routes protected except `GET /setlists/:id`; `POST /setlists/:id/played` requires auth
- Sessions: DynamoDB `kittens-sessions`, 180-day TTL; users: `kittens-users`

### API layer — `src/lib/api.ts`
All components talk to this file only. Makes `fetch()` calls to `PUBLIC_API_URL` (`.env.local` for dev, GitHub Actions var for prod). Bearer token injected automatically.

### Emoji — `static/emoji/` + `src/routes/+layout.svelte`
All emoji are rendered as **Google Noto Color Emoji SVGs** for consistent cross-platform appearance (critical for Windows). SVG files are self-hosted in `static/emoji/` — named by Unicode codepoint (e.g. `1f3b8.svg` for 🎸).

A `MutationObserver` in `+layout.svelte` uses `@twemoji/api` as the emoji parser — it scans the DOM for emoji text and replaces them with `<img class="emoji">` tags pointing to the local SVGs.

> **IMPORTANT — MANDATORY RULE:** Every emoji used anywhere in the UI **must** have its SVG pre-downloaded into `static/emoji/`. Missing SVGs produce 404s. Whenever you add or change an emoji in any `.svelte` or `.ts` file, you MUST immediately run the curl command below to download the corresponding SVG. Do not skip this step.

**To add a new emoji:**
1. Find its Unicode codepoint — e.g. `U+1F3B8` → filename `1f3b8.svg`. Drop any variation selector (`U+FE0F`) from the filename.
2. Download the SVG from Noto Color Emoji (covers Emoji 15+):
   ```bash
   curl -o static/emoji/{codepoint}.svg \
     "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/svg/emoji_u{codepoint}.svg"
   ```
3. No code changes needed — the observer picks it up automatically.

### i18n — `src/lib/i18n.ts`
- `lang` store (`'ru' | 'en'`), default `'ru'`, persisted to `localStorage('lang')`
- `t` derived store — import and use as `$t.section.key` in any component
- Russian has proper plural forms via `ruPlural()` helper
- To add a string: add to both `en` and `ru` objects

### Theme
- `dark` state in `+layout.svelte`, persisted to `localStorage('theme')`, applied as `data-theme="dark|light"` on `<html>`
- **Always use `browser` from `$app/environment`** to guard any localStorage access

## Data Model — `src/lib/types.ts`

```ts
type Category = 'top' | 'mid' | 'low'
// canonical display order: vocals, guitar, bass, keys, violin, drums, cajon, percussion
type Instrument = 'guitar' | 'bass' | 'drums' | 'keys' | 'cajon' | 'violin' | 'percussion' | 'vocals'
type LearningStage = 'nothing' | 'queue' | 'structure' | 'mastering' | 'ready'

interface MusicianRole {
  instruments: Instrument[]  // empty = present in song but "free"; multiple allowed
}

interface BandMusician {
  id: string
  name: string
  defaultInstruments?: Instrument[]  // pre-selected when adding a song (multiple allowed)
  sortOrder?: number                  // roster display order; drag-to-reorder in /musicians
  guest?: boolean                     // reserved; ad-hoc guests are used in practice (see below)
}

interface Song {
  id: string
  artist: string
  title: string
  category: Category       // top=💩 По говну, mid=🎵 Середняк, low=🧪 Андеграунд (emojis rendered as Google Noto SVGs)
  comment?: string         // general note
  musicians: Record<string, MusicianRole>  // keyed by musician name
  sortOrder?: number
  progress?: Record<string, LearningStage>  // keyed by musician name
}

interface Setlist {
  id: string
  name: string
  date?: string
  startTime?: string       // HH:MM; drives per-entry start time display in editor + stage
  entries: SetlistEntry[]  // sorted by entry.order
}

interface SetlistEntry {
  songId?: string          // absent for break entries
  song?: Song              // full snapshot embedded at time of adding; frozen — backlog edits don't propagate
  breakMinutes?: number    // present for break entries (10 / 20 / 30)
  order: number
  played: boolean          // stage mode tap-to-strikethrough
  comment?: string         // per-entry note; shown and edited inline + in the per-entry edit modal
  progress?: Record<string, LearningStage>  // per-entry learning progress (all musicians incl. guests)
}
```

## Musicians

Managed via `/musicians` page. Stored in DynamoDB (`kittens-musicians` table).
Default roster: Илья (bass), Андрей (drums), iLJa (guitar), Тоня (keys), Маша (violin).

Each musician has `defaultInstruments[]` — pre-selected when creating/editing a song (multiple allowed).
In the song edit modal, all 8 instruments are shown for every musician; multiple can be selected simultaneously.
Roster order is configurable via drag-to-reorder on `/musicians`; `sortOrder` is persisted and controls column order everywhere (backlog table, setlist editor, stage view).

### Guest musicians (ad-hoc)
Guests are **not** pre-registered in the musicians roster. They are typed inline in the song edit modal below the permanent roster rows — once a name is entered, instrument buttons appear and a new empty row is added for the next guest. Guests are stored as extra keys in `song.musicians` whose names don't match any `BandMusician`.

Guest display:
- **Backlog / setlist editor** — compact inline bubble pills after the song title: `🎤 Саша · 🪇 Вася`
- **Stage view** — appear in the 3-per-row musician grid after permanent members; also appear in the musician highlight picker (dashed border to distinguish from permanent)

## Backlog Filter Logic

- **Category** — multi-select (All resets to none; any combination of top/mid/low)
- **Musicians** — multi-select, **AND** (all selected must have at least one instrument in the song)
- **Instruments** — multi-select, **OR**, but scoped:
  - If musicians selected → at least one *selected* musician plays one of the instruments
  - If no musician selected → any musician in the song plays one of the instruments
- **Search** — artist or title substring
- **Sort** — click Artist or Title column header; click again to reverse

## Musician Column Table

The backlog table has one column per permanent roster member.
Each cell shows all instrument icons for that musician (sorted by `INSTRUMENT_ORDER`), blank if not in the song.
Guest musicians are shown as inline bubble pills after the song title instead of columns.
Column order always follows the musicians store roster order.
Every other musician column has a tinted zebra background (`--musician-alt-bg`).

## Setlist Editor

- Drag-to-reorder via HTML5 DnD; drop zone at the bottom handles items past the last row
- Rendered as a proper `<table>` with one column per musician — instrument icons align across all rows
- Category icon shown before song name; guest bubble tags shown inline after title
- **Musician filter bar** — multi-select AND chips above the table (same logic as backlog); breaks hidden while a filter is active; drag-to-reorder disabled while filtered
- **Song snapshots** — `entry.song` is a full copy of the song at add time; backlog edits never affect it
- **Per-entry edit** — ✏️ button opens `SongEditModal` in entry mode; saves song snapshot + comment separately
- **Breaks** — "⏸ Перерыв" button in the header opens a picker (10 / 20 / 30 min); breaks are draggable rows that span musician columns; stored as `SetlistEntry` with `breakMinutes` set and no `songId`
- **Inline meta editing** — click ✏️ in header to edit setlist name, date, startTime in place
- **startTime** — when set, a ⏱ time column appears showing per-entry approximate start times (5 min/song + break minutes)
- **Per-entry comments** — `CommentInput.svelte` saves on blur; syncs from prop when not focused (so modal saves reflect immediately)
- **Polling** — fetches setlist every 3 s; smart merge skips no-ops, protects drag state

## Stage View

- Compact cards: `[#] [cat icon] Title  Artist(muted)`
- Musicians shown in a 3-per-row CSS grid; instrument icons + name; amber pill background; guests appear after permanent members
- Tap any song card to toggle played (fades + strikethrough); optimistic update then confirmed from server
- Breaks shown as dashed separator rows `⏸ 10 мин`; start time (if set) shown right-aligned in accent color
- Progress counter counts only song entries (not breaks); duration includes break minutes
- Sort: Default order | Artist | Title; filter by category (multi-select)
- **Musician highlight picker** — selects one musician; their pill is highlighted amber across all cards; guests from the setlist appear with dashed border
- **startTime** — when set, each card and break row shows its approximate start time (right-aligned, accent color)
- **Polling** — fetches setlist every 2 s; skips update if entries are identical
- `CategoryBadge` supports `iconOnly` prop — used in editor and stage view
