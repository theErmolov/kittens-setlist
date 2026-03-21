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
- **AWS Lambda** (Node 22, arm64) + **API Gateway HTTP API** + **DynamoDB** (3 tables)
- API URL: `https://bw1e6cey18.execute-api.eu-central-1.amazonaws.com/prod`
- Deploy: `sam build && sam deploy --profile personal` (SAM stack `kittens-setlist`, `eu-central-1`)
- **TypeScript** strict mode
- **No CSS framework** — plain scoped styles + CSS custom properties

## Running

```bash
npm run dev       # dev server at localhost:5173
npm run check     # type check (svelte-check)
npm run build     # production build
```

## Architecture

### Base path / GitHub Pages
- `paths.base` in `svelte.config.js` is set from `process.env.BASE_PATH` (empty for local/CloudFront, `/kittens-setlist` for GitHub Pages)
- SvelteKit does **not** auto-prepend `base` to `href` attributes — every Svelte file with absolute hrefs must `import { base } from '$app/paths'` and use `href="{base}/route"`
- `goto()` is base-aware (no change needed); `redirect()` is not — use `` `${base}/route` ``

### API layer — `src/lib/api.ts`
All components talk to this file only, never to stores directly.
Makes `fetch()` calls to `PUBLIC_API_URL` (set in `.env.local` for dev, GitHub Actions var for prod).
All functions are async.
**Normalization:** old DynamoDB data has `{instrument?: string, vocals?: boolean}` per role; `normalizeRole()` converts to `{instruments: Instrument[]}` transparently on every read.

### i18n — `src/lib/i18n.ts`
- `lang` writable store (`'ru' | 'en'`), default `'ru'`, persisted to `localStorage('lang')`
- `t` derived store — import and use as `$t.section.key` in any component
- Russian has proper plural forms via `ruPlural()` helper
- To add a string: add to both `en` and `ru` objects (TypeScript will error if they diverge)

### Theme — `src/routes/+layout.svelte`
- `dark` state, persisted to `localStorage('theme')`
- Applied as `data-theme="dark|light"` on `<html>`
- CSS vars defined in `:root` (light) and `[data-theme="dark"]` blocks
- **Always use `browser` from `$app/environment`** to guard any localStorage access — SvelteKit SSR makes `localStorage` exist but non-functional

## Data Model — `src/lib/types.ts`

```ts
type Category = 'top' | 'mid' | 'low'
// canonical display order: vocals, guitar, bass, keys, violin, drums, percussion, maracas
type Instrument = 'guitar' | 'bass' | 'drums' | 'keys' | 'percussion' | 'violin' | 'maracas' | 'vocals'

interface MusicianRole {
  instruments: Instrument[]  // empty = present in song but "free"; multiple allowed
}

interface BandMusician {
  id: string
  name: string
  defaultInstrument?: Instrument  // pre-selected when adding a song
  sortOrder?: number               // roster display order; drag-to-reorder in /musicians
  guest?: boolean                  // reserved; ad-hoc guests are used in practice (see below)
}

interface Song {
  id: string
  artist: string
  title: string
  category: Category       // top=💩 По говну, mid=🎵 Середняк, low=🧪 Андеграунд
  comment?: string         // general note
  musicians: Record<string, MusicianRole>  // keyed by musician name
  sortOrder?: number
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
}
```

## Musicians

Managed via `/musicians` page. Stored in DynamoDB (`kittens-musicians` table).
Default roster: Илья (bass), Андрей (drums), iLJa (guitar), Тоня (keys), Маша (violin).

Each musician has one `defaultInstrument` — pre-selected when creating/editing a song.
In the song edit modal, all 8 instruments are shown for every musician; multiple can be selected simultaneously.
Roster order is configurable via drag-to-reorder on `/musicians`; `sortOrder` is persisted and controls column order everywhere (backlog table, setlist editor, stage view).

### Guest musicians (ad-hoc)
Guests are **not** pre-registered in the musicians roster. They are typed inline in the song edit modal below the permanent roster rows — once a name is entered, instrument buttons appear and a new empty row is added for the next guest. Guests are stored as extra keys in `song.musicians` whose names don't match any `BandMusician`.

Guest display:
- **Backlog / setlist editor** — compact inline bubble pills after the song title: `🎤 Саша · 🪇 Вася`
- **Stage view** — appear in the 3-per-row musician grid after permanent members; also appear in the musician highlight picker (dashed border to distinguish from permanent)

## Routes

```
/                          → redirect to /backlog
/backlog                   → song catalog with table, filters, add/edit/delete
/setlists                  → list of setlists
/setlists/[id]             → setlist editor (drag-to-reorder)
/setlists/[id]/stage       → stage view (mobile-first, tap to mark played)
```

## File Structure

```
src/
  lib/
    api.ts                 ← all backend calls; normalization of old data formats
    types.ts
    i18n.ts                ← all UI strings (ru + en)
    utils.ts               ← formatDuration, addMinutes, sortInstruments, INSTRUMENT_ORDER
    stores/songs.ts
    stores/setlists.ts
    stores/musicians.ts
  components/
    backlog/
      SongTable.svelte     ← toolbar, filter bar (category + musician + instrument), table
      SongRow.svelte        ← one row; musician columns + guest bubble tags inline
      SongEditModal.svelte  ← permanent musicians + ad-hoc guest rows; multi-instrument toggle grid
      InstrumentPicker.svelte
    setlist/
      SetlistCard.svelte
      SetlistEditor.svelte  ← drag-to-reorder via HTML5 DnD; per-entry song edit modal
      AddSongsModal.svelte
      CommentInput.svelte   ← isolated $state; syncs from prop when not focused
    stage/
      StageView.svelte      ← sort + category filters, musician highlight picker, played counter
      StageSong.svelte      ← tap to toggle played; 3-per-row musician grid incl. guests
    shared/
      LogoCat.svelte        ← inline SVG cat logo
      CategoryBadge.svelte
      FilterChips.svelte
      SortBar.svelte
      TopBar.svelte
  routes/
    +layout.svelte          ← nav ("Центр управления / Котят"), theme toggle, lang toggle, global CSS vars
    +page.server.ts         ← redirect / → /backlog
    backlog/+page.svelte
    setlists/+page.svelte
    setlists/[id]/+page.svelte
    setlists/[id]/stage/+page.svelte
    musicians/+page.svelte  ← add/edit/delete band roster, set default instrument
```

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
- **Song snapshots** — `entry.song` is a full copy of the song at add time; backlog edits never affect it
- **Per-entry edit** — ✏️ button opens `SongEditModal` in `mode="entry"`; saves via `updateEntrySong` + `updateEntryComment`; `entry.comment` is the single source of truth shown both inline and in the modal
- **Breaks** — "⏸ Перерыв" button in the header opens a picker (10 / 20 / 30 min); breaks are draggable rows that span musician columns; stored as `SetlistEntry` with `breakMinutes` set and no `songId`
- API: `addBreakToSetlist`, `removeBreakFromSetlist` (removes by `order`)
- **Inline meta editing** — click ✏️ in header to edit setlist name, date, startTime in place; saved via `updateSetlist`
- **startTime** — when set, a ⏱ time column appears showing per-entry approximate start times (5 min/song + break minutes)
- **Per-entry comments** — rendered via `CommentInput.svelte`; saved on blur via `updateEntryComment`; syncs from prop when input is not focused (so modal saves reflect immediately)
- **Polling** — fetches setlist every 3 s; smart merge skips no-ops, protects drag state

## Stage View

- Compact cards: `[#] [cat icon] Title  Artist(muted)`
- Musicians shown in a 3-per-row CSS grid; instrument icons + name; amber pill background; guests appear after permanent members
- Tap any song card to toggle played (fades + strikethrough); optimistic update then confirmed from server
- Breaks shown as dashed separator rows `⏸ 10 мин`; start time (if set) shown right-aligned in accent color
- Progress counter counts only song entries (not breaks); duration includes break minutes
- Sort: Default order | Artist | Title
- Filter by category chip (multi-select)
- **Musician highlight picker** — selects one musician; their pill is highlighted amber across all cards; guests from the setlist appear with dashed border
- **startTime** — when set on the setlist, each card and break row shows its approximate start time (right-aligned, accent color)
- **Polling** — fetches setlist every 2 s; skips update if entries are identical
- `CategoryBadge` supports `iconOnly` prop — used in editor and stage view
