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
- Emoji note: 💰/🧾 SVGs not vendored (egress policy blocks jsdelivr); reused existing 📊 (nav) + 📋 (receipt) from `static/emoji/`

## Known data issues

- Old setlist entries without `.song` snapshot show nothing in stage/editor until re-added
- Vocals needs re-entry for all existing songs (data loss from earlier refactor)
