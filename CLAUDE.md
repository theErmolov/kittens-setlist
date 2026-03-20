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

### API layer — `src/lib/api.ts`
All components talk to this file only, never to stores directly.
Makes `fetch()` calls to `PUBLIC_API_URL` (set in `.env.local` for dev, GitHub Actions var for prod).
All functions are async.

### Stores — `src/lib/stores/`
- `songs.ts` — writable store, persisted to localStorage key `kittens_songs`
- `setlists.ts` — writable store, persisted to localStorage key `kittens_setlists`
- `musicians.ts` — writable store, persisted to localStorage key `kittens_musicians`
- Version keys: `kittens_data_version` (songs) and `kittens_musicians_version` (musicians) — bump `DATA_VERSION` / `MUSICIANS_VERSION` in the respective store file to wipe stale localStorage

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
type Instrument = 'guitar' | 'bass' | 'drums' | 'keys' | 'percussion' | 'violin'

interface MusicianRole {
  instrument?: Instrument  // undefined = present in song but "free" (no specific instrument)
  vocals: boolean
}

interface BandMusician {
  id: string
  name: string
  defaultInstrument?: Instrument  // pre-selected when adding a song; single value
  sortOrder?: number               // roster display order; drag-to-reorder in /musicians
}

interface Song {
  id: string
  artist: string
  title: string
  category: Category       // top=💩 По говну, mid=🎵 Середняк, low=🧪 Андеграунд
  comment?: string
  musicians: Record<string, MusicianRole>  // keyed by musician name; all band members always included
  comment?: string         // general note; copied to SetlistEntry.comment when song is added to a setlist
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
  breakMinutes?: number    // present for break entries (10 / 20 / 30)
  order: number
  played: boolean          // stage mode tap-to-strikethrough
  comment?: string         // per-entry note (same song can have different comment per setlist)
}
```

## Musicians

Managed via `/musicians` page. Stored in DynamoDB (`kittens-musicians` table).
Default roster: Илья (bass), Андрей (drums), iLJa (guitar), Тоня (keys), Маша (violin).

Each musician has one `defaultInstrument` — pre-selected when creating/editing a song.
In the song edit modal, all 6 instruments are always shown for every musician; they can pick any or leave themselves free.
Musicians cannot be removed from a song — only their instrument assignment can be cleared.
Roster order is configurable via drag-to-reorder on `/musicians`; `sortOrder` is persisted and controls column order everywhere (backlog table, setlist editor, stage view).

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
    api.ts                 ← SWAP THIS for real backend
    types.ts
    i18n.ts                ← all UI strings (ru + en)
    stores/songs.ts
    stores/setlists.ts
    stores/musicians.ts
    data/mock-songs.json
  components/
    backlog/
      SongTable.svelte     ← toolbar, filter bar (category + musician + instrument), table
      SongRow.svelte        ← one row; musician columns dynamic based on allMusicians prop
      SongEditModal.svelte  ← all band musicians shown; instrument per musician, vocals toggle
    setlist/
      SetlistCard.svelte
      SetlistEditor.svelte  ← drag-to-reorder via HTML5 DnD
      AddSongsModal.svelte
    stage/
      StageView.svelte      ← sort + category/comment filters, played counter
      StageSong.svelte      ← tap to toggle played (strikethrough)
    shared/
      LogoCat.svelte        ← inline SVG cat logo
      CategoryBadge.svelte
      FilterChips.svelte
      SortBar.svelte
      TopBar.svelte
  routes/
    +layout.svelte          ← nav, theme toggle, lang toggle, global CSS vars
    +page.server.ts         ← redirect / → /backlog
    backlog/+page.svelte
    setlists/+page.svelte
    setlists/[id]/+page.svelte
    setlists/[id]/stage/+page.svelte
    musicians/+page.svelte  ← add/edit/delete band roster, set default instrument
```

## Backlog Filter Logic

- **Category** — multi-select (All resets to none; any combination of top/mid/low)
- **Musicians** — multi-select, **AND** (all selected must appear in the song)
- **Instruments** — multi-select, **OR**, but scoped:
  - If musicians selected → at least one *selected* musician plays one of the instruments
  - If no musician selected → any musician in the song plays one of the instruments
- **Vocals** — toggle 🎤, scoped the same way as instruments
- **Search** — artist or title substring
- **Sort** — click Artist or Title column header; click again to reverse

## Musician Column Table

The backlog table has one column per band musician (always all roster members).
Each cell shows their instrument icon in a fixed-width slot + 🎤 if vocals, blank if not in the song.
Column order always follows the musicians store roster order.
Every other musician column has a tinted zebra background (`--musician-alt-bg`).

## Setlist Editor

- Drag-to-reorder via HTML5 DnD; drop zone at the bottom handles items past the last row
- Rendered as a proper `<table>` with one column per musician — instrument icons align across all rows
- Category icon shown before song name
- **Breaks** — "⏸ Перерыв" button in the header opens a picker (10 / 20 / 30 min); breaks are draggable rows that span musician columns; stored as `SetlistEntry` with `breakMinutes` set and no `songId`
- API: `addBreakToSetlist`, `removeBreakFromSetlist` (removes by `order`)
- **Inline meta editing** — click ✏️ in header to edit setlist name, date, startTime in place; saved via `updateSetlist`
- **startTime** — when set, a time column appears showing per-entry approximate start times (5 min/song + break minutes); break rows also show their start time aligned to the same column
- **Per-entry comments** — rendered via `CommentInput.svelte` (isolated `$state`); saved on blur via `updateEntryComment`; isolation means polling-triggered re-renders cannot reset in-progress typing
- **Polling** — fetches setlist every 3 s; smart merge skips no-ops, protects drag state

## Stage View

- Compact cards: `[#] [cat icon] Title  Artist(muted)`
- Musicians shown in a CSS grid (one column per roster member, fixed position); instrument icons + name truncated with ellipsis when space is tight; amber pill background
- Tap any song card to toggle played (fades + strikethrough); optimistic update then confirmed from server
- Breaks shown as dashed separator rows `⏸ 10 мин`; start time (if set) shown right-aligned in accent color
- Progress counter counts only song entries (not breaks); duration includes break minutes
- Sort: Default order | Artist | Title
- Filter by category chip (multi-select) + 💬 Comment toggle
- **startTime** — when set on the setlist, each card and break row shows its approximate start time (right-aligned, accent color)
- **Polling** — fetches setlist every 2 s; skips update if entries are identical
- `CategoryBadge` supports `iconOnly` prop — used in editor and stage view
