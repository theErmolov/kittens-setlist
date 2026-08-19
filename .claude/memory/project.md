---
name: kittens_setlist_project
description: Non-obvious project context — band roster and known data issues
type: project
---

## ⚠️ Current session state (2026-08-18) — handoff

Two features fully implemented + verified, **NOT committed/pushed** (per hard rules — user must explicitly say "commit"/"push"). Full plan: `/Users/iermolov/.claude/plans/greedy-churning-gadget.md`.

1. **Presence-based polling** (Option B) + 2. **Nav bar stability** — both documented in their own sections below. Code passes `api tsc --noEmit`, `npm run check` (0 errors), `npm run build`.

**Next steps for the continuing agent:**
- Commit + push when the user asks (push → CI/CD deploys backend). Backend deploy is what *activates* presence — until then the frontend degrades safely (heartbeat 404 → `lastOk=false` → polls at original intervals, no green dot, no regression). So frontend can be live before backend.
- **Live verification after deploy** (couldn't do from sandbox — no live AWS/browser access): open same setlist in two writer tabs → green dot appears under 🎪 on both, edits sync; close one → dot vanishes within ~20s, remaining tab stops polling. Also: admin reloads any page → nav bar must not jump (icons cached from first paint); after logout → /login shows no admin/logout chrome.
- Touched files: `template.yaml`, `api/src/{index.ts,lib/dynamo.ts,lib/types.ts,handlers/presence.ts(new)}`, `src/lib/{api.ts,auth.ts,types.ts,presence.ts(new)}`, `src/components/{setlist/SetlistEditor.svelte,stage/StageView.svelte}`, `src/routes/+layout.svelte`.

## Band roster (in DynamoDB)

- Илья (bass) — that's the user
- Андрей (drums)
- iL'Ja (guitar)
- Тоня (keys)
- Маша (violin)

## Auth / roles

- `KittensUser.role?: 'writer' | 'reader'` — added to both frontend and backend types
- `isAdmin: true` = admin (full access); `role: 'writer'` = writer; `role` absent or `'reader'` = read-only (default)
- `canWrite` derived store in `src/lib/auth.ts` — import this to gate any mutation UI
- Server enforces: readers get 403 on all non-GET requests (`api/src/index.ts`)
- Polling: admin/writer stage=2s, reader stage=10s; admin/writer backlog=10s, reader backlog=50s
- Admin panel has role selector (Writer/Reader) for pending and approved users
- Lambda must be re-deployed after backend type/handler changes

## Budget (admin-only money tracking)

- New view `/budget` — **admin-only** for both view and edit (`isAdmin`); nav link gated by `isAdmin`
- Backend route `/budget` in `api/src/index.ts` rejects non-admins (403) even for GET (financial data)
- One DynamoDB table `kittens-budget` (HASH `id`), single `kind` discriminator: `income | expense | debt`
- Amounts stored as **integer EUR cents** (avoid float drift); `parseEUR`/`formatEUR`/`formatAmount` in `src/lib/utils.ts`
- Income/expense tagged `method: 'cash' | 'transfer'`; debts are unpaid liabilities (`paid` flag)
- Aggregation/report helpers in `src/lib/utils.ts`: `budgetTotals`, `buildBudgetReport` (the «По баблу» copy-paste text); on-hand = cumulative income−expenses by method, balance = on-hand − unpaid debts
- Entries optionally assign to a setlist (`setlistId`); modal suggests the event within −24h/+72h of now
- Expense **receipts** in S3 bucket `kittens-receipts-${AccountId}` (template.yaml) via presigned PUT/GET URLs; `api/src/lib/s3.ts`, route `/budget/:id/receipt-url`. Needs `@aws-sdk/client-s3` + `s3-request-presigner`
- Files: `api/src/handlers/budget.ts`, `src/routes/budget/+page.svelte`, `src/components/budget/BudgetEntryModal.svelte`
- Emoji: 💰 (`1f4b0`, nav) + 🧾 (`1f9fe`, receipts) vendored in `static/emoji/`

## Setlist subsets ("сеты") — in progress, NOT YET DEPLOYED

- Built 2026-07-12: quick on-stage-break workflow to pick the next 7-10 songs from a big unsorted +vibe setlist, with auto-sort to minimize instrument changes. See CLAUDE.md "Non-obvious design decisions" for the invariant and algorithm summary.
- Files: `src/lib/subsetSort.ts` (new), `src/components/setlist/SetlistEditor.svelte` (editing UI), `src/components/stage/StageView.svelte` (display-only grouping), `api/src/handlers/setlists.ts` (`/order` now accepts optional `subsets`), types in both `src/lib/types.ts` and `api/src/lib/types.ts`.
- **Cost model refined after first real screenshot review (2026-07-12)**: vocals excluded from comparison; adjacent (distance-1) songs cost 1 only if the instrument literally differs; a **1-song skip always costs 1** regardless of whether the musician returns to the same instrument — physically stepping off/back on stage is disruptive even without an instrument change; 2+-song skip is free (clean break). The naive first version scored a same-instrument 1-song skip as free, which produced skip-play-skip-play orderings a real user rejected on sight — don't reintroduce that without re-deriving from a concrete example.
- **Full-width `<td>` gotcha**: giving a `colspan`'d `<td>` `display: flex` directly strips it of `display: table-cell` and breaks colspan (row collapses to a small floating box instead of spanning). Fix: keep the `<td>` a plain cell and put `display: flex` on an inner wrapper `<div>` instead. Applies to the subset header/hint rows in `SetlistEditor.svelte`.
- **Quick-set mode (`activeSubsetId` set) allows BOTH tap-to-toggle and drag-to-reorder simultaneously** (changed from the original "drag disabled while active" design after user feedback wanted manual reordering inside a subset). This works because a real drag gesture (finger/mouse moves past `DRAG_THRESHOLD`) never synthesizes a trailing `click`, so `onclick={handleRowClick}` and `draggable`/touch-drag on the same row don't conflict — no need to special-case `activeSubsetId` in `canDrag`, `handleDragHandleTouchStart`, or the break row's `draggable`.
- **`onDrop` subset-boundary bug (fixed)**: dropping a subset's *last* song back near its own tail computed `nextItem` as the first pool item (not a same-subset neighbor), so the old rule read that as "left the subset" and kicked it into the pool. Fix: landing right after a subset member now joins that subset whenever `nextItem` has no subsetId of its own (pool boundary or end of list), not only when `nextItem` shares the same subsetId. See the comment in `onDrop`.
- The ✕ (remove) button on a subset member removes it from the subset (not the whole setlist) while that subset is the active one in quick-set mode — see `handleRemoveClick`.
- **Backend must be deployed (push) before the frontend feature is usable** — until then `PUT /order`'s `subsets` field is silently ignored by the live Lambda and any subset created in the editor will vanish on the next poll/reconcile (old handler never returns `subsets`, so `applyUpdate`/`applyPoll` reset local state to `[]`). Ship backend+frontend together.
- Verified: `subsetSort.ts` cost model against brute-force for n≤8 plus a regression test built from the real skip-play-skip-play screenshot; `npm run check`/`npm run build` (frontend); `tsc --noEmit` (backend, clean for touched files). Not yet verified end-to-end in a real browser session by Claude (no browser-automation tool available) — the user is verifying visually via screenshots instead.

## Song archive (2026-07-13)

- `Song.archived?: boolean` — added to both `src/lib/types.ts` and `api/src/lib/types.ts`; no backend route changes needed since `PUT /songs/:id` already saves the whole song object. Added to the audit `diffSummary` field list in `api/src/handlers/songs.ts` so archive/unarchive shows up in the change log.
- Archiving never touches setlists — `SetlistEntry.song` is a frozen snapshot (existing invariant), so archived-ness of the catalog song has no effect on any setlist.
- `SongTable.svelte`: new `showArchived` toggle chip (📦, next to the 📊 progress toggle, both desktop filter-bar and mobile filter panel). `scoped()` derived filters `songs` by `archived` before category/search/musician/instrument filtering feeds off it — archived hidden by default, chip flips to an archive-only view (not a combined view).
- Toggle button lives in `SongEditModal.svelte` footer (📦/📤, only when `mode !== 'entry'` and an existing song is being edited — never in the setlist-entry snapshot editor). Flips `draft.archived` and immediately saves+closes via the existing `onsave` flow.
- `AddSongsModal.svelte` (setlist song picker) excludes archived songs from its list so they can't be added to a new setlist.
- Verified end-to-end with Playwright against a mocked API (real AWS backend/Telegram auth not reachable from this sandbox): default view hides archived, archive toggle shows only archived, modal archive button flips the flag and the song disappears from the default list immediately.

## Presence-based polling (2026-08-18)

Setlist editor + stage poll `GET /setlists/:id` only when another user who can mutate is viewing the same setlist. Cuts idle polling (and mobile battery) to ~zero when alone.

- **`kittens-presence` table** (template.yaml): HASH `setlistId`, RANGE `clientId`, TTL `expiresAt` (90s). Mirrors `SessionsTable`'s TTL pattern.
- **Heartbeat = presence check (one round trip).** `POST /setlists/:id/presence { clientId }` upserts the caller's item, queries all live items for that setlist, returns `{ others }` (excluding caller + expired). `DELETE /setlists/:id/presence?clientId=…` removes self on leave (keepalive fetch). Route is **public** (works anonymous, like `GET /setlists/:id`) — opportunistic auth in `api/src/index.ts` (`isPresence`); handler `api/src/handlers/presence.ts`.
- **`canMark` derived server-side** (`isAdmin || role==='writer'`; anon = false). Clients suppress their data poll only when a heartbeat has *successfully* confirmed no other `canMark` client is present. Readers/anonymous never justify polling. `dbQueryPartition` helper added to `api/src/lib/dynamo.ts`.
- **Per-tab `clientId`** in `sessionStorage` (not `user.id`) — two tabs of the same user are distinct clients that can mutate, so each must see the other and keep polling. Keying by `user.id` would make each tab think it's alone and miss its own other tab's edits.
- **Graceful degradation:** suppression requires `lastOk` (a successful heartbeat). Old backend (no route → 404) or network blip → `lastOk=false` → poll as before, no regression. Frontend can ship before backend.
- **`PresenceController`** (`src/lib/presence.ts`): 20s heartbeat, pauses on tab-hidden, immediate re-tick on visible, `pagehide` → leave. Wired into `SetlistEditor.svelte` + `StageView.svelte` `onMount` — combined into the poller's `isPaused` as `… || presence.isPaused()`, `presence.stop()` in cleanup.
- **Green dot:** `presencePollingActive` store (true = `lastOk && hasOtherMutators`) → small absolutely-positioned green dot under the 🎪 nav icon in `+layout.svelte` (CSS dot, no emoji). Lit only while a setlist view is live-syncing. Dot semantics chosen to avoid a mount-time flicker (not lit during heartbeat failure).
- **Backlog polling is NOT presence-gated** — it polls the song catalog, rarely collaborative.

## Nav bar stability (2026-08-18)

The admin-only nav links (💰 budget, 🔑 admin, 🛡️ antispam) and 🚪 logout button appear only once `initAuth()` resolves, causing a reflow jump on every load (worst on mobile where links are `flex:1`). Fixed by caching auth-derived flags in `localStorage` and seeding first paint from the cache:
- `getCachedNavFlags` / `setCachedNavFlags` / `clearNavCache` in `src/lib/auth.ts` (keys `kittens_nav_admin`, `kittens_nav_logged_in`).
- `+layout.svelte` seeds `navIsAdmin`/`navLoggedIn` from cache, an `$effect` syncs them to `$currentUser` once `authLoading` clears and re-writes the cache, the admin block gates on `navIsAdmin`, logout on `navLoggedIn`. `logout()` calls `clearNavCache()` so post-logout `/login` shows no admin/logout chrome.
- First-ever visit (no cache) and role changes get a one-time correction; steady state is jump-free.

## Known data issues

- Old setlist entries without `.song` snapshot show nothing in stage/editor until re-added
- Vocals needs re-entry for all existing songs (data loss from earlier refactor)
