---
name: kittens_setlist_project
description: State of the Kittens Setlist webapp — what's built, what's next, key decisions
type: project
---

Band setlist manager for "Музыкальные Котятки". Replaces a Google Sheet.

**Why:** Band needed dedicated tooling for backlog management and on-stage setlist use.
Multiple musicians will share it eventually.

**Current state:** Full stack live. Frontend talks to real AWS backend.
- Backlog with musician/instrument/category filters and musician-column table; sorted by artist by default
- Setlist manager with drag-to-reorder; per-entry comments (editable inline, saved to backend)
- Stage view (mobile-first, tap to mark played, sort/filter by category/comment)
- Real-time polling: stage polls every 2s, setlist editor every 3s; seamless merge (no blink)
- Light/dark theme toggle (localStorage)
- RU/EN language toggle (localStorage), RU default
- Musicians management page (`/musicians`) — add/edit/delete roster, set default instrument, drag-to-reorder (order persisted via `sortOrder` field)

**Category colors (consistent everywhere):** top=💩 red, mid=🎵 purple, low=🧪 green

**Backend (live):**
- AWS Lambda (Node 22, arm64) + API Gateway HTTP API
- DynamoDB — 3 tables: `kittens-songs`, `kittens-setlists`, `kittens-musicians`
- API URL: `https://bw1e6cey18.execute-api.eu-central-1.amazonaws.com/prod`
- SAM stack: `kittens-setlist` in `eu-central-1`
- Deployed via `sam build && sam deploy --profile personal`
- AWS profile: `personal` (IAM user `kittens-admin`, account `540966180378`)
- All setlist mutation endpoints return the full updated `Setlist` object
- `PATCH /setlists/:id/entry-comment` — update per-entry comment

**Frontend:**
- `adapter-static` with `fallback: 200.html` (SPA mode)
- `PUBLIC_API_URL` in `.env.local` points to API Gateway
- All pages fetch from API in `onMount`
- `src/lib/poller.ts` — reusable polling utility (pause on hidden tab, resume on focus)
- Setlist editor and stage view maintain `localEntries = $state(...)` updated from every API response
- Polling uses smart merge: skips no-op updates, protects drag state and focused comment inputs
- Stores (`songs.ts`, `setlists.ts`, `musicians.ts`) are now unused by pages but kept in repo

**Repo:** `git@github-personal:theErmolov/kittens-setlist.git`
- SSH alias `github-personal` → personal account (theErmolov)
- Local git identity: Ilia Ermolov / in.ermolov@gmail.com

**Band roster (in DynamoDB):**
- Илья (bass) — that's the user
- Андрей (drums)
- iL'Ja (guitar)
- Тоня (keys)
- Маша (violin)

**Pending:**
- CloudFront + S3 frontend hosting — blocked pending AWS account verification (CF needs support case)
- GitHub Actions CI/CD workflows are written but CF/S3 vars not yet set
- Lambda@Edge basic auth (edge/basic-auth.ts) — written but not deployed
- Old stores (`songs.ts`, `setlists.ts`, `musicians.ts`) still in repo but unused — can be deleted
