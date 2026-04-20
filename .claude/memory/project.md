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

## Known data issues

- Old setlist entries without `.song` snapshot show nothing in stage/editor until re-added
- Vocals needs re-entry for all existing songs (data loss from earlier refactor)
