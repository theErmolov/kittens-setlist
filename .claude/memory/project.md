---
name: kittens_setlist_project
description: Non-obvious project context — band roster and known data issues
type: project
---

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

## Known data issues

- Old setlist entries without `.song` snapshot show nothing in stage/editor until re-added
- Vocals needs re-entry for all existing songs (data loss from earlier refactor)
