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

- Built 2026-07-12: quick on-stage-break workflow to pick the next 7-10 songs from a big unsorted +vibe setlist, with auto-sort to minimize instrument changes (vocals excluded; a musician skipping 2+ songs resets the "change" count to 0). See CLAUDE.md "Non-obvious design decisions" for the invariant and algorithm summary.
- Files: `src/lib/subsetSort.ts` (new), `src/components/setlist/SetlistEditor.svelte` (editing UI), `src/components/stage/StageView.svelte` (display-only grouping), `api/src/handlers/setlists.ts` (`/order` now accepts optional `subsets`), types in both `src/lib/types.ts` and `api/src/lib/types.ts`.
- **Backend must be deployed (push) before the frontend feature is usable** — until then `PUT /order`'s `subsets` field is silently ignored by the live Lambda and any subset created in the editor will vanish on the next poll/reconcile (old handler never returns `subsets`, so `applyUpdate`/`applyPoll` reset local state to `[]`). Ship backend+frontend together.
- Not yet verified end-to-end in a real browser (no browser-automation tool available in that session, and local dev auth needs a token copied from kittens.band on a real device). Verified: `subsetSort.ts` cost model against brute-force for n≤8, `npm run check`/`npm run build` (frontend), `tsc --noEmit` (backend, clean for the touched files).

## Known data issues

- Old setlist entries without `.song` snapshot show nothing in stage/editor until re-added
- Vocals needs re-entry for all existing songs (data loss from earlier refactor)
