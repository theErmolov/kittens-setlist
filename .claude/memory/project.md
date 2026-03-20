---
name: kittens_setlist_project
description: State of the Kittens Setlist webapp — what's built, what's next, key decisions
type: project
---

Band setlist manager for "Музыкальные Котятки". Replaces a Google Sheet.

**Why:** Band needed dedicated tooling for backlog management and on-stage setlist use.
Multiple musicians will share it eventually.

**Current state:** Full stack live. Frontend talks to real AWS backend.
- Backlog with musician/instrument/category filters and musician-column table
- Setlist manager with drag-to-reorder
- Stage view (mobile-first, tap to mark played, sort/filter)
- Light/dark theme toggle (localStorage)
- RU/EN language toggle (localStorage), RU default
- Musicians management page (`/musicians`) — add/edit/delete roster, set default instrument

**Backend (live):**
- AWS Lambda (Node 22, arm64) + API Gateway HTTP API
- DynamoDB — 3 tables: `kittens-songs`, `kittens-setlists`, `kittens-musicians`
- API URL: `https://bw1e6cey18.execute-api.eu-central-1.amazonaws.com/prod`
- SAM stack: `kittens-setlist` in `eu-central-1`
- Deployed via `sam build && sam deploy --profile personal`
- AWS profile: `personal` (IAM user `kittens-admin`, account `540966180378`)

**Frontend:**
- `adapter-static` with `fallback: 200.html` (SPA mode)
- `PUBLIC_API_URL` in `.env.local` points to API Gateway
- All pages fetch from API in `onMount` — no more localStorage stores for data
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
- CloudFront + S3 frontend hosting — blocked pending AWS account verification (no payment method issue resolved, but CF still needs support case)
- GitHub Actions CI/CD workflows are written but CF/S3 vars not yet set
- Lambda@Edge basic auth (edge/basic-auth.ts) — written but not deployed
- `src/lib/api.ts` rewrite done; old stores still exist but are unused
