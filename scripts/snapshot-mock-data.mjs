#!/usr/bin/env node
/**
 * Copies the REAL data from the backend into `src/lib/dev/mock-data.json`, which the dev mock API (`VITE_DEV_MOCK=1`) then serves.
 * The file contains personal data (users, finances) and is git-ignored — never commit it.
 *
 *   MOCK_SNAPSHOT_TOKEN=<admin auth_token from localStorage on kittens.band> npm run mock:snapshot
 *
 * The API URL is taken from PUBLIC_API_URL in `.env`. Read-only: it only issues GET requests.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fillMissing } from './mock-generators.mjs';

const env = Object.fromEntries(
  (() => { try { return readFileSync('.env', 'utf8'); } catch { return ''; } })()
    .split('\n').map(l => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]),
);
const base = process.env.PUBLIC_API_URL ?? env.PUBLIC_API_URL;
const token = process.env.MOCK_SNAPSHOT_TOKEN;
if (!base || !token) {
  console.error('Need PUBLIC_API_URL (in .env) and MOCK_SNAPSHOT_TOKEN (an admin auth_token) in the environment.');
  process.exit(1);
}

async function get(path, optional = false) {
  const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    if (optional) { console.warn(`  skipped ${path} (${res.status})`); return undefined; }
    throw new Error(`GET ${path} → ${res.status}`);
  }
  return res.json();
}

console.log('Fetching from', base);
const [me, users, musicians, songs, setlists, rehearsalList, budget, notificationPreferences] = await Promise.all([
  get('/auth/me'), get('/auth/users', true), get('/musicians'), get('/songs'), get('/setlists'), get('/rehearsals', true), get('/budget', true), get('/notification-preferences', true),
]);
// List endpoints may omit details: fetch each rehearsal in full.
const rehearsals = rehearsalList ? await Promise.all(rehearsalList.map(r => get(`/rehearsals/${r.id}`, true).then(full => full ?? r))) : [];
const audit = [];
let cursor;
for (let page = 0; page < 5; page++) {
  const res = await get(`/auth/audit-log?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, true);
  if (!res) break;
  audit.push(...res.items);
  cursor = res.nextCursor;
  if (!cursor) break;
}

const snapshot = { takenAt: new Date().toISOString(), me, users, musicians, songs, setlists, rehearsals, budget, audit, notificationPreferences };
// Categories the backend returned nothing for (empty or not allowed) get plausible generated data, built from what WAS fetched.
snapshot.generated = fillMissing(snapshot);
if (snapshot.generated.length) console.log('Generated (nothing fetched):', snapshot.generated.join(', '));
writeFileSync('src/lib/dev/mock-data.json', JSON.stringify(snapshot, null, 1));
console.log(`Saved src/lib/dev/mock-data.json: ${snapshot.users.length} users, ${snapshot.musicians.length} musicians, ${snapshot.songs.length} songs, ${snapshot.setlists.length} setlists, ${snapshot.rehearsals.length} rehearsals, ${snapshot.budget.length} budget entries, ${snapshot.audit.length} audit entries.`);
