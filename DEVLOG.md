# Devlog — Музыкальные Котятки Setlist App

A summary of how the app was built, session by session.

---

## 1. Initial build

Started from a plan doc. The band had been managing their song backlog and show setlists in a Google Sheet — the goal was to replace it with a dedicated webapp.

**Stack decision:** Svelte 5 + SvelteKit + Vite. Chosen over htmx because the first phase is frontend-only with mock data, and htmx is server-driven. Svelte compiles to tiny vanilla JS, good for mobile. When the AWS backend is ready, only the `src/lib/api.ts` layer needs to change.

**What got built in one shot:**

- Full data model (`Song`, `Setlist`, `SetlistEntry`) with TypeScript
- Mock songs JSON with 12 tracks
- Svelte stores backed by localStorage (`songs.ts`, `setlists.ts`)
- API layer (`api.ts`) — all functions async, ready to swap for real HTTP
- All four routes: `/backlog`, `/setlists`, `/setlists/[id]`, `/setlists/[id]/stage`
- All components: `SongTable`, `SongRow`, `SongEditModal`, `InstrumentPicker`, `SetlistCard`, `SetlistEditor`, `AddSongsModal`, `StageView`, `StageSong`, shared `CategoryBadge`, `FilterChips`, `SortBar`, `TopBar`
- Dark theme with CSS custom properties
- Song count in toolbar
- Stage view: tap-to-strikethrough, sort by artist/title/default, filter by category, comment filter

**First bug hit immediately:** `localStorage.getItem is not a function` on page load.
Root cause: SvelteKit SSR runs stores on the server where `localStorage` exists as an object but its methods don't work. `typeof localStorage === 'undefined'` doesn't catch this. Fixed by importing `browser` from `$app/environment` and guarding all localStorage access with `if (!browser)`.

---

## 2. Polishing round

Several things requested at once:

**Logo.** The band is called "Музыкальные Котятки" (Musical Kittens). Built a custom inline SVG cat logo — pointed ears, face, whiskers, a musical note. Displayed in the nav with a two-line lockup: `МУЗЫКАЛЬНЫЕ` in small muted caps, **Котятки** in a purple-to-pink gradient.

**Category icons reworked.** The three tiers got new meaning:
- `top` → 💩 (band humour — their best songs are the "pile of shit" ones)
- `mid` → 🎵
- `low` → 🧪 (underground/experimental)

**Five permanent musicians defined:** Илья, Андрей, iL'Ja, Тоня, Маша. These became the defaults in the Add Song modal and were populated into all mock songs.

**Instrument changes:**
- Bass got its own icon 🪕 (banjo emoji) to visually distinguish it from guitar 🎸
- Violin 🎻 added as a new instrument type throughout (types, picker, icons, mock data)

---

## 3. Light theme

Switched from dark-only to a light theme: white surfaces on soft lavender-gray (`#f5f4f8`), same purple accent. Category badge colours adjusted for light backgrounds.

---

## 4. Theme toggle

Added a 🌙/☀️ button in the nav. Preference stored in localStorage. Implemented via a `data-theme` attribute on `<html>` and two sets of CSS custom properties:

```css
:root, [data-theme="light"] { --bg: #f5f4f8; ... }
[data-theme="dark"]          { --bg: #0f1117; ... }
```

Body and nav surfaces get a `transition: background 0.2s` for a smooth switch.

---

## 5. Bigger header

Nav height bumped from 48px to 72px (1.5×). Logo scaled from 34px to 50px, nav links from 0.9rem to 1.05rem, brand name from 0.95rem to 1.25rem.

---

## 6. Song counts everywhere

Every view now shows how many songs are visible:
- **Backlog toolbar:** `8 / 12 songs` — shows filtered vs total; just `12 songs` when nothing is filtered
- **Setlist editor header:** total songs in the setlist
- **Stage view:** `2/12` played counter, gains `· 5 shown` when category/comment filters are active

---

## 7. Language toggle RU/EN

Full i18n system built from scratch:

- `src/lib/i18n.ts` — `lang` writable store (default `'ru'`), `t` derived store exposing all strings
- Every component imports `$t` and uses it for all UI text
- Russian has proper plural forms: 1 песня / 2 песни / 5 песен
- RU/EN chip added to the nav next to the theme toggle, preference persisted to localStorage

Russian category names are band-specific slang, not generic translations:
- top → **💩 По говну**
- mid → **🎵 Середняк**
- low → **🧪 Андеграунд** (requested spelled out in full after initial "Андер")

---

## 8. Drag-to-reorder in setlist editor

HTML5 Drag and Drop API, no library. Features:
- `⠿` drag handle visible on hover
- Dragged item fades to 35% opacity
- Drop target gets a dashed purple border highlight
- List previews the new order live while dragging
- On drop, new order is persisted to the store
- Up/down arrow buttons removed — drag handles the job

---

## 9. Musician table in backlog

**The request:** "it must be a table, so that I can see immediately in my column, where I play."

Replaced the compact musician chips with proper per-musician columns in the backlog table. Each musician (Илья, Андрей, iL'Ja, Тоня, Маша) gets their own column. Each cell shows their instrument icon + 🎤 if they sing, blank if they don't play that song. Columns are ordered by first appearance in the songs data.

---

## 10. Musician & instrument filters

**Filter bar** added between the toolbar and the table, with two groups separated by a vertical divider:

- **Left — musician chips** (names): multi-select with **AND logic** — selecting Илья + Маша shows only songs where *both* appear together
- **Right — instrument icons** (🎸 🪕 🥁 🎹 🪘 🎻): multi-select with **OR logic**, but *scoped*:
  - If musicians are selected → instruments filter applies only to those musicians ("Маша + 🎻 = songs where Маша plays violin")
  - If no musician selected → any musician in the song playing that instrument matches

---

## 11. Documentation

**`CLAUDE.md`** created at the project root — auto-loaded by Claude Code every session. Contains: architecture, data model, filter logic, file structure, i18n/theme systems, backend plan.

**Project-scoped memory** at `.claude/memory/` inside the repo:
- `project.md` — current state and next steps
- `feedback.md` — preferences, gotchas (the localStorage SSR bug, category label slang, scoped filter logic)

These travel with the repo so context isn't lost when switching machines or collaborators.

---

## 12. Musicians management

**The request:** a view to manage the band roster — add/edit/delete musicians, set their default instrument. The song edit modal should use this roster instead of a freeform list.

**New page `/musicians`** — list of band members, each showing their default instrument icon. Add/edit form with a single-select instrument picker (click to select, click again to deselect → free).

**Data model additions:**
- `BandMusician` interface: `{ id, name, defaultInstrument? }`
- `MusicianRole.instrument` made optional — `undefined` means the musician is in the song but "free" (no specific instrument assigned)
- New `musicians.ts` store, persisted to `kittens_musicians` with its own version key

**Song edit modal reworked:**
- All band musicians always shown — there's no "add/remove from song" toggle, everyone is always present
- All 6 instruments shown for every musician (not just their defaults) — anyone can play anything
- Their `defaultInstrument` is pre-selected when a new song is created
- Clicking an active instrument deselects it, leaving the musician "free"

**Vocals made mandatory.** Saving a song with no vocalist pops `"А поёт эту хуйню кто?"` and blocks the save. Not skippable — it's an `alert()`, not a `confirm()`.

**Column order fixed.** Musician columns in the backlog table now always follow the roster order (Илья → Андрей → iL'Ja → Тоня → Маша) rather than first-appearance in songs.

---

## 13. Real song data

Replaced the 12-song mock dataset with the band's full catalog exported from their Google Sheet (183 songs). A Node.js conversion script parsed the CSV (`Setlist - Т.csv`) and mapped emoji columns to the typed data model. `DATA_VERSION` bumped to `'4'` to wipe stale localStorage on first load.

---

## 14. Backlog table improvements

- **Sticky header** — `th` elements are `position: sticky; top: 0`. Required switching the table to `border-collapse: separate` (Safari bug) and giving `.table-container` an explicit `height: calc(100dvh - 72px)` so the scroll container is bounded.
- **Sortable columns** — Artist and Title headers are clickable; clicking toggles asc/desc. Arrow indicator shows active sort.
- **Category multi-select** — `FilterChips` reworked: "All" resets the set, any combination of 💩/🎵/🧪 can be active simultaneously. Applied to both backlog and stage view.
- **Vocals filter** — 🎤 chip in the instrument filter row; same scoping logic as instrument filter (scoped to selected musicians if any).
- **Zebra musician columns** — every other musician column gets a tinted `--musician-alt-bg` background.
- **Vocals-only alignment** — musician cell uses a fixed-width `inst-slot` span so 🎤 always appears in the second position even when there is no instrument.

---

## 15. Setlist editor table

Converted the setlist editor song list from a flex `<ol>/<li>` layout to a proper `<table>`. Each musician gets a named column header; instrument icons align vertically across all rows. Category icon moved before artist name. Breaks (see below) span musician columns with a dashed row style.

---

## 16. Breaks in setlists

Added support for break entries in setlists:

- **Data model** — `SetlistEntry.songId` made optional; new optional `breakMinutes` field. Backward-compatible (existing song entries unchanged).
- **Editor UI** — "⏸ Перерыв" button in the header opens an inline picker (10 / 20 / 30 min). Breaks are draggable table rows. A drop zone `<tr>` at the bottom of the table lets items be placed after the last row (fixes inability to drag past a trailing break).
- **Stage view** — breaks render as a compact dashed row `⏸ N мин`. Always shown in default order; hidden when sorting by artist/title. Progress counter excludes breaks.

---

## 17. Stage view redesign

- **Compact cards** — padding reduced, font sizes trimmed.
- **Layout reordered** — `[#] [cat icon] Title  Artist` — song title is the primary element (bold), artist name follows in muted smaller text.
- **No checkmark** — removed the ✓ played indicator; opacity + strikethrough is sufficient.

---

## Tech decisions worth noting

| Decision | Reason |
|---|---|
| Svelte 5 runes everywhere | No `$:` reactive statements — `$state`, `$derived`, `$effect` only |
| All API functions async | Ready to swap localStorage for real HTTP with no component changes |
| `browser` guard on localStorage | SvelteKit SSR quirk — `typeof localStorage` check is not enough |
| `DATA_VERSION` / `MUSICIANS_VERSION` in stores | Bump to wipe stale localStorage when data shape changes |
| No CSS framework | Plain scoped styles + CSS custom properties is enough; keeps bundle tiny |
| i18n as derived store | `$t.section.key` in any component; adding a language = add one object |
| Validation copy in Russian colloquial | Band-internal tool — "А поёт эту хуйню кто?" is intentional |
