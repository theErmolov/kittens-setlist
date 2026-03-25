---
name: kittens_setlist_project
description: State of the Kittens Setlist webapp — what's built, what's next, key decisions
type: project
---

Band setlist manager for "Музыкальные Котятки". Replaces a Google Sheet.

**Why:** Band needed dedicated tooling for backlog management and on-stage setlist use.

**Current state:** Full stack live at kittens.band. Telegram auth live.

## What's built

- Backlog with musician/instrument/category filters and musician-column table
- Setlist manager with drag-to-reorder; per-entry comments
- Stage view (mobile-first, tap to mark played, sort/filter)
- Real-time polling: stage 2s (auth) / 10s (unauth), setlist editor 3s
- Light/dark theme + RU/EN language toggle (localStorage)
- Musicians management page — add/edit/delete, default instrument, drag-to-reorder
- **Telegram auth** — login widget, pending/approved/rejected flow, superadmin approval, musician mapping, /admin panel

## Auth system (added 2026-03-25)

- Login via Telegram Login Widget (`@kittens_control_center_bot`)
- Backend verifies Telegram hash (`api/src/lib/telegram.ts`); sessions in DynamoDB with 180-day TTL
- Superadmin = `SUPERADMIN_TELEGRAM_ID` env var (auto-approved on first login)
- New users → pending state until superadmin approves via `/admin`
- All API routes protected except `GET /setlists/:id` (stage view polling)
- Stage view: public read, tap-to-mark disabled when unauthenticated
- Frontend auth guard in `+layout.svelte`; token in localStorage
- New DynamoDB tables: `kittens-users` (PK: telegramId), `kittens-sessions` (PK: token, TTL on expiresAt)
- SAM params: `TelegramBotToken` (secret), `SuperadminTelegramId` (secret) → GitHub secrets in CI

## Backend

- AWS Lambda (Node 22, arm64) + API Gateway HTTP API
- DynamoDB — 5 tables: `kittens-songs`, `kittens-setlists`, `kittens-musicians`, `kittens-users`, `kittens-sessions`
- API URL: `https://bw1e6cey18.execute-api.eu-central-1.amazonaws.com/prod`
- SAM stack: `kittens-setlist` in `eu-central-1`
- Deploy: `sam build && sam deploy --profile personal --parameter-overrides TelegramBotToken=... SuperadminTelegramId=...`
- AWS profile: `personal` (IAM user `kittens-admin`, account `540966180378`)

## Frontend

- CloudFront + S3 (bucket `kittens-setlist-frontend-540966180378`, dist `E3D2LL7A33NW5T`)
- Custom domain: `kittens.band`
- `adapter-static` with `fallback: 200.html` (SPA mode)
- GitHub Actions auto-deploy on push to main (`src/**`, `static/**`)
- `PUBLIC_API_URL` + `PUBLIC_TELEGRAM_BOT_USERNAME=kittens_control_center_bot` in build env

## Repo

- `git@github-personal:theErmolov/kittens-setlist.git`
- SSH alias `github-personal` → personal account (theErmolov)
- Local git identity: Ilia Ermolov / in.ermolov@gmail.com

## Band roster (in DynamoDB)

- Илья (bass) — that's the user
- Андрей (drums)
- iL'Ja (guitar)
- Тоня (keys)
- Маша (violin)

## Pending / known issues

- Old stores (`songs.ts`, `setlists.ts`, `musicians.ts`) still in repo but unused — can be deleted
- Old setlist entries without `.song` snapshot show nothing in stage/editor until re-added
- Vocals needs re-entry for all existing songs (data loss from earlier refactor)
- `edge/basic-auth.ts` — superseded by Telegram auth, can be deleted
