# Security Audit Report — Музыкальные Котятки Setlist App

## CRITICAL

---

### C1 — Any authenticated user can wipe or corrupt any setlist
**File:** `api/src/handlers/setlists.ts:147-154`

```typescript
// PUT /setlists/:id/order
const { entries } = JSON.parse(event.body ?? '{}') as { entries: SetlistEntry[] };
const setlist = await dbGet<Setlist>(TABLE, id);
const updated: Setlist = { ...setlist, entries };   // ← replaces entire entries array
await dbPut(TABLE, updated as unknown as Record<string, unknown>);
```

The `/order` endpoint is guarded by auth but accessible to **any approved user** (not just admin). It replaces the entire `entries` array with whatever the client sends — no validation, no integrity check. A malicious user can:
- Send `{ "entries": [] }` to **permanently delete all songs** from a setlist
- Inject `entry.song` objects containing arbitrary/fabricated song data
- There is no optimistic locking — concurrent writes silently overwrite each other

The `/entry-song` PATCH (line 100) has the same injection risk: it accepts a full `Song` object from the client and embeds it in the setlist entry with no verification that it exists in the songs table.

---

### C2 — Arbitrary song data injected into setlists
**File:** `api/src/handlers/setlists.ts:34`

```typescript
// POST /setlists/:id/songs
const { songs } = JSON.parse(event.body ?? '{}') as { songs: Song[] };
// ...
.map((s, i) => ({ songId: s.id, song: s, order: maxOrder + 1 + i, played: false }));
```

Songs are embedded as "frozen snapshots" but they come **directly from the client body**. No lookup against the `songs` table — any approved user can craft a request with a fake song object (any artist, title, category, musician assignments) and it gets stored permanently in the setlist. This bypasses the entire songs/backlog access control.

---

### C3 — `PUT /setlists/:id` — full document replacement with no validation
**File:** `api/src/handlers/setlists.ts:164-167`

```typescript
const body = JSON.parse(event.body ?? '{}') as Setlist;
await dbPut(TABLE, { ...body, id } as unknown as Record<string, unknown>);
```

Any approved user can replace an entire setlist document with arbitrary content. The `id` from the path is enforced, but all other fields (name, date, entries, etc.) are taken verbatim from the request body. No field filtering, no type checking at runtime.

---

## HIGH

---

### H1 — Admin status cannot be revoked
**File:** `api/src/handlers/auth.ts:87`

```typescript
isAdmin: isAdmin || existing?.isAdmin,
```

`isAdmin` is set to `true` only when `data.id === SUPERADMIN_TELEGRAM_ID`. But once set, it persists forever via the `||` expression. If `SUPERADMIN_TELEGRAM_ID` is rotated (e.g., to a new Telegram account), the previous admin retains full admin access indefinitely. There is no endpoint to set `isAdmin: false`, and `PATCH /auth/users/:id` does not touch the `isAdmin` field.

---

### H2 — User `status` field accepts arbitrary string values
**File:** `api/src/handlers/auth.ts:161`

```typescript
...(patch.status ? { status: patch.status as KittensUser['status'] } : {}),
```

The type assertion `as KittensUser['status']` is compile-time only. At runtime, `patch.status` can be any string (`"god"`, `"superadmin"`, `""`, etc.), and it is written directly to DynamoDB. The approved/pending/rejected check at `index.ts:42` is a string comparison — an unexpected value (`user.status !== 'approved'`) would lock out a user permanently with no recovery path through the UI.

---

### H3 — `auth_date` NaN bypass in Telegram verification
**File:** `api/src/lib/telegram.ts:35-37`

```typescript
const authDate = parseInt(data.auth_date, 10);
const now = Math.floor(Date.now() / 1000);
if (now - authDate > 3600) return false;  // NaN > 3600 → false → check skipped
```

If `auth_date` is a non-numeric string, `parseInt` returns `NaN`. `NaN > 3600` is `false`, so the 1-hour expiry check is **silently skipped** and the auth data passes as non-expired. Exploiting this requires a valid HMAC (the attacker needs the bot token), so practical impact is limited — but if the token were ever leaked, an attacker could replay Telegram auth data of any age indefinitely.

---

### H4 — Unbounded DynamoDB full-table scans
**File:** `api/src/handlers/songs.ts:15`, `setlists.ts:17`, `musicians.ts:8`, `auth.ts:132`

All `GET` collection endpoints use `dbScan()` with no pagination, filtering, or limit. As the songs catalog grows, each `/songs` request fetches the full table into Lambda memory. At ~500+ songs this starts causing latency; at Lambda's 256 MB memory limit it will crash, triggering 500 errors for all users. The `/auth/users` scan is also unbounded.

---

### H5 — Single Lambda with full CRUD on all 5 tables
**File:** `template.yaml:64-74`

```yaml
Policies:
  - DynamoDBCrudPolicy: { TableName: !Ref SongsTable }
  - DynamoDBCrudPolicy: { TableName: !Ref SetlistsTable }
  - DynamoDBCrudPolicy: { TableName: !Ref MusiciansTable }
  - DynamoDBCrudPolicy: { TableName: !Ref UsersTable }
  - DynamoDBCrudPolicy: { TableName: !Ref SessionsTable }
```

One Lambda function handles all routes and has full read/write/delete on every table including `kittens-users` and `kittens-sessions`. A bug in the songs or musicians handler could be chained to compromise user records or forge sessions. Principle of least privilege is violated.

---

### H6 — CORS wildcard on a credentialed API
**File:** `template.yaml:42-43`, `api/src/index.ts:22`

```yaml
AllowOrigins:
  - '*'
```

The API uses Bearer tokens in `Authorization` headers (not cookies), so CORS wildcard doesn't allow cross-site session hijacking directly. However, combined with the `Authorization` header being `AllowHeaders`, any origin can instruct a browser to make authenticated requests. Should be restricted to `https://kittens.band`.

---

## MEDIUM

---

### M1 — No input length or type validation on any user-supplied string
**Files:** `setlists.ts`, `songs.ts`, `musicians.ts`

Comment fields, song titles, artist names, musician names — all are accepted without length limits. An authenticated user can store megabyte-sized strings in a single DynamoDB item, inflating storage and causing the item to hit DynamoDB's 400 KB item size limit, which would corrupt that record permanently (DynamoDB silently rejects the write with an exception, which is unhandled).

---

### M2 — Auth tokens stored in `localStorage`
**File:** `src/lib/auth.ts:13-23`

Session tokens are stored in `localStorage`, making them accessible to any JavaScript running on the page. An XSS vulnerability anywhere in the app would allow full session theft. `HttpOnly` cookies set by the server are not accessible to JS and would be safer, though they require `SameSite` configuration to address CSRF.

---

### M3 — Session TTL is 180 days
**File:** `api/src/handlers/auth.ts:10`

```typescript
const SESSION_TTL_SECONDS = 180 * 24 * 60 * 60; // 180 days
```

A stolen token is valid for 6 months. There is no mechanism to list or revoke all sessions for a user (e.g., "logout everywhere"), and logout only removes the specific session token from the current client. A compromised account has no recovery path short of direct DynamoDB access.

---

### M4 — Global rate limit is too coarse
**File:** `template.yaml:54-56`

```yaml
ThrottlingBurstLimit: 20
ThrottlingRateLimit: 10
```

10 req/s applies to the entire API, not per-IP or per-endpoint. The `/auth/telegram` login endpoint has no dedicated stricter limit. An attacker can hit it with 10 login attempts per second to enumerate valid Telegram user IDs or probe for account states (pending/approved/rejected differences visible from response codes — 403 vs 401).

---

### M5 — No `PATCH /auth/users/:id` for `isAdmin` field
**File:** `api/src/handlers/auth.ts:136-171`

The admin PATCH endpoint explicitly handles `status` and `musicianId` but has no path to set `isAdmin: false`. Combined with H1, there is no in-application way to demote an admin once set.

---

## LOW

---

### L1 — No Content-Security-Policy headers
The API and CloudFront distribution set no CSP headers. If an XSS vector is introduced, there is no browser-level restriction on script sources, inline script execution, or data exfiltration.

---

### L2 — Telegram Login Widget loaded without Subresource Integrity
**File:** `src/routes/login/+page.svelte`

```typescript
script.src = 'https://telegram.org/js/telegram-widget.js?22';
```

No `integrity` attribute. A compromised CDN or MITM could inject arbitrary JavaScript executed in your auth page's context.

---

### L3 — No audit log for admin actions
Admin approval, rejection, and musician mapping actions (`PATCH /auth/users/:id`) leave no audit trail. Malicious admin activity cannot be investigated after the fact.

---

### L4 — `randomUUID()` for session tokens is fine, but format is predictable
**File:** `api/src/handlers/auth.ts:94`

UUIDv4 provides 122 bits of entropy — sufficient. However, UUID format is well-known and has structured bits, reducing entropy slightly vs `crypto.randomBytes(32).toString('hex')`. Not a practical vulnerability but worth noting.

---

## Summary Table

| ID | Severity | Title | File:Line |
|----|----------|-------|-----------|
| C1 | **Critical** | Any user can wipe/replace all setlist entries | `setlists.ts:147` |
| C2 | **Critical** | Fake songs injected into setlists from client | `setlists.ts:34` |
| C3 | **Critical** | Full setlist document replaced without validation | `setlists.ts:164` |
| H1 | High | Admin status is irrevocable | `auth.ts:87` |
| H2 | High | `status` field accepts arbitrary strings | `auth.ts:161` |
| H3 | High | `NaN` bypasses auth_date expiry check | `telegram.ts:35` |
| H4 | High | Unbounded full-table scans on all collections | `songs.ts:15`, etc. |
| H5 | High | Single Lambda has full CRUD on all 5 tables | `template.yaml:64` |
| H6 | High | CORS wildcard on credentialed API | `template.yaml:42` |
| M1 | Medium | No string length/type validation anywhere | all handlers |
| M2 | Medium | Auth tokens in `localStorage` (XSS-accessible) | `auth.ts:13` |
| M3 | Medium | Session TTL 180 days with no revocation | `auth.ts:10` |
| M4 | Medium | No per-endpoint/per-IP rate limiting | `template.yaml:54` |
| M5 | Medium | No way to demote an admin via the API | `auth.ts:136` |
| L1 | Low | No CSP headers | infrastructure |
| L2 | Low | Telegram widget lacks SRI | `login/+page.svelte` |
| L3 | Low | No audit log for admin actions | all handlers |
| L4 | Low | UUID session token format (minor) | `auth.ts:94` |

---

## Remediation Priority

**Fix immediately (data integrity risk):**
- **C1**: Add server-side validation on `/order` — verify entry IDs exist in the setlist, check array length, restrict to admin or add CSRF token per operation
- **C2/C3**: Never trust client-supplied song objects; fetch from `songs` table by ID on the server side before embedding
- **H2**: Validate `status` against `['pending', 'approved', 'rejected']` before writing

**Fix soon (auth/access risk):**
- **H1/M5**: Add a `PATCH /auth/users/:id` field for `isAdmin: false`; document the direct-DB fallback
- **H3**: Add `if (isNaN(authDate)) return false` before the expiry check in `telegram.ts`
- **H4**: Add DynamoDB `Limit` + `LastEvaluatedKey` pagination on all scans
- **M1**: Add `maxLength` checks on all string inputs (suggested: 500 chars for comments, 200 for names)

**Plan for later:**
- **H5**: Split Lambda into auth/data functions with scoped IAM policies
- **H6/L1**: Lock `AllowOrigins` to `kittens.band`; add CSP headers via CloudFront response headers policy
- **M2**: Consider moving token to `HttpOnly` cookie (requires backend changes)
- **M3**: Reduce TTL to 7-14 days; add `DELETE /auth/sessions` to invalidate all sessions for a user
