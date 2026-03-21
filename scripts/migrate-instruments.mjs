/**
 * One-shot migration: old format → new format
 *
 * Songs/setlist snapshots:
 *   {instrument?: string, vocals?: boolean} → {instruments: string[]}
 *
 * Musicians:
 *   {defaultInstrument?: string} → {defaultInstruments: string[]}
 *
 * Run with AWS credentials that have read/write on the three tables:
 *   node scripts/migrate-instruments.mjs
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'eu-central-1' }));

async function scan(table) {
  const items = [];
  let lastKey;
  do {
    const res = await client.send(new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey }));
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function put(table, item) {
  await client.send(new PutCommand({ TableName: table, Item: item }));
}

function migrateRole(role) {
  if (!role) return { instruments: [] };
  if (Array.isArray(role.instruments)) return role; // already new format
  const instruments = [];
  if (role.instrument) instruments.push(role.instrument);
  if (role.vocals) instruments.push('vocals');
  return { instruments };
}

function migrateSong(song) {
  if (!song) return song;
  const musicians = {};
  for (const [name, role] of Object.entries(song.musicians ?? {})) {
    musicians[name] = migrateRole(role);
  }
  return { ...song, musicians };
}

// ── Songs ──────────────────────────────────────────────────────────────────

console.log('Migrating kittens-songs...');
const songs = await scan('kittens-songs');
let songsUpdated = 0;
for (const song of songs) {
  const migrated = migrateSong(song);
  if (JSON.stringify(migrated) !== JSON.stringify(song)) {
    await put('kittens-songs', migrated);
    songsUpdated++;
    console.log(`  ✓ ${song.artist} – ${song.title}`);
  }
}
console.log(`  ${songsUpdated}/${songs.length} songs updated.\n`);

// ── Setlists (embedded song snapshots) ────────────────────────────────────

console.log('Migrating kittens-setlists...');
const setlists = await scan('kittens-setlists');
let setlistsUpdated = 0;
for (const setlist of setlists) {
  const entries = (setlist.entries ?? []).map(e =>
    e.song ? { ...e, song: migrateSong(e.song) } : e
  );
  const migrated = { ...setlist, entries };
  if (JSON.stringify(migrated) !== JSON.stringify(setlist)) {
    await put('kittens-setlists', migrated);
    setlistsUpdated++;
    console.log(`  ✓ ${setlist.name}`);
  }
}
console.log(`  ${setlistsUpdated}/${setlists.length} setlists updated.\n`);

// ── Musicians ──────────────────────────────────────────────────────────────

console.log('Migrating kittens-musicians...');
const musicians = await scan('kittens-musicians');
let musiciansUpdated = 0;
for (const m of musicians) {
  if (m.defaultInstruments !== undefined) continue; // already migrated
  const defaultInstruments = m.defaultInstrument ? [m.defaultInstrument] : [];
  const { defaultInstrument, ...rest } = m;
  const migrated = { ...rest, defaultInstruments };
  await put('kittens-musicians', migrated);
  musiciansUpdated++;
  console.log(`  ✓ ${m.name}`);
}
console.log(`  ${musiciansUpdated}/${musicians.length} musicians updated.\n`);

console.log('Migration complete.');
