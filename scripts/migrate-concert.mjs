#!/usr/bin/env node
/**
 * One-off migration: "На полпути из пизды в могилу" concert, May 2, 17:00
 *
 * Usage:
 *   AUTH_TOKEN=<token_from_browser> node scripts/migrate-concert.mjs
 *   AUTH_TOKEN=xxx DRY_RUN=1 node scripts/migrate-concert.mjs   # preview only
 */

const API   = 'https://bw1e6cey18.execute-api.eu-central-1.amazonaws.com/prod';
const TOKEN = process.env.AUTH_TOKEN;
const DRY   = process.env.DRY_RUN === '1';

if (!TOKEN) { console.error('AUTH_TOKEN env var required'); process.exit(1); }

// ─── helpers ─────────────────────────────────────────────────────────────────

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, ...(opts.headers ?? {}) },
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`${opts.method ?? 'GET'} ${path} → ${res.status}: ${t}`); }
  return res.json();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function key(artist, title) { return `${artist}|${title}`; }

function findSong(songs, artist, title) {
  const al = artist.toLowerCase().trim();
  const tl = title.toLowerCase().trim();
  return (
    songs.find(s => s.artist === artist && s.title === title) ||
    songs.find(s => s.artist.toLowerCase() === al && s.title.toLowerCase() === tl) ||
    songs.find(s => s.artist.toLowerCase().includes(al.slice(0, 6)) && s.title.toLowerCase() === tl) ||
    null
  );
}

// ─── data ────────────────────────────────────────────────────────────────────

// Songs that should NOT get progress='ready' (marked "new" or "доделать")
const SKIP_PROGRESS = new Set([
  // new
  'Bloodhound Gang|The Ballad of Chasey Lane',
  'Jane Air|Junk',
  'Limp Bizkit|Break Stuff',
  'Pain|Shut your mouth',
  'TequilajaZZZ|Кроме звёзд',
  'Дельфин|Я люблю людей',
  'Король и Шут|Северный флот',
  'Ляпис Трубецкой|Ты кинула',
  'Пионерлагерь Пыльная Совка|Очки',
  'Порнофильмы|Русский Христос',
  'Пошлая Молли|Нон-стоп',
  // доделать
  'Lumen|Сид и Нэнси',
  'The Cranberries|Zombie',
  'Би-2|Варвара',
  'Би-2|Мой рок-н-ролл',
  'Дельфин|Весна',
  'Иван Дорн|Стыцамэн',
  'Многоточие|Щемит в душе тоска',
  'Сплин|Выхода Нет',
  'Шура/Nirvana|Ты не веришь слезам',
]);

// Named guest musicians per setlist entry (from "Доп. музыканты" column)
// instruments: valid values are guitar/bass/drums/keys/cajon/violin/percussion/vocals
const ENTRY_GUESTS = {
  'Jane Air|Junk':                    { Андрюха: ['guitar'] },
  'Limp Bizkit|Break Stuff':          { Андрюха: ['guitar'] },
  'TequilajaZZZ|Кроме звёзд':        { Андрюха: ['guitar'], Саша: ['vocals', 'keys'] },
  'The Cranberries|Zombie':           { Андрюха: ['guitar'], Саша: ['vocals'] },
  "Акустика sex'a|Строчки на выдох": { Андрюха: ['guitar'], Саша: ['vocals'] },
  'Дельфин|Весна':                    { Артур: ['vocals'] },
  'Дельфин|Я люблю людей':           { Артур: ['vocals', 'guitar'] },
  'Кирпичи|Джедаи':                  { Артур: ['vocals'] },
  'Многоточие|Щемит в душе тоска':   { Артур: ['vocals'] },
};

// All setlist songs in screenshot order
const SETLIST_ORDER = [
  ['...И друг мой грузовик', 'Удобен'],
  ["5'Nizza",                  'Ты Кидал'],
  ['Animal ДжаZ',              'Чувства'],
  ['Bloodhound Gang',          'The Ballad of Chasey Lane'],
  ['Idles',                    'Crawl!'],
  ['Jane Air',                 'Junk'],
  ['Limp Bizkit',              'Break Stuff'],
  ['Lumen',                    'Сид и Нэнси'],
  ['Pain',                     'Shut your mouth'],
  ['TequilajaZZZ',             'Кроме звёзд'],
  ['The Cranberries',          'Zombie'],
  ['Агата Кристи',             'Как На Войне'],
  ["Акустика sex'a",           'Строчки на выдох'],
  ['Бабкин',                   'Забери'],
  ['Би-2',                     'Варвара'],
  ['Би-2',                     'Мой рок-н-ролл'],
  ['Валентин Стрыкало',        'Альбина'],
  ['Город 312',                'Вне зоны доступа'],
  ['Гречка',                   'Люби меня люби'],
  ['Дайте Танк (!)',           'Грех'],
  ['Дайте Танк (!)',           'Слова-Паразиты'],
  ['Дайте Танк (!)',           'Утро'],
  ['Дельфин',                  'Весна'],
  ['Дельфин',                  'Я люблю людей'],
  ['Земфира',                  'П. М. М. Л.'],
  ['Иван Дорн',                'Стыцамэн'],
  ['Кирпичи',                  'Джедаи'],
  ['Король и Шут',             'Ведьма и Осел'],
  ['Король и Шут',             'Дагон'],
  ['Король и Шут',             'Ели Мясо Мужики'],
  ['Король и Шут',             'Камнем по голове'],
  ['Король и Шут',             'Кукла Колдуна'],
  ['Король и Шут',             'Лесник'],
  ['Король и Шут',             'Проклятый старый дом'],
  ['Король и Шут',             'Прыгну со скалы'],
  ['Король и Шут',             'Ром'],
  ['Король и Шут',             'Северный флот'],
  ['Ляпис Трубецкой',          'Капитал'],
  ['Ляпис Трубецкой',          'Ты кинула'],
  ['Максим',                   'Знаешь ли ты'],
  ['Многоточие',               'Щемит в душе тоска'],
  ['Мумий Тролль',             'Такие девчонки'],
  ['Найк Борзов',              'Верхом на звезде'],
  ['Пионерлагерь Пыльная Совка', 'Очки'],
  ['Порнофильмы',              'Русский Христос'],
  ['Порнофильмы',              'Это Пройдёт'],
  ['Пошлая Молли',             'Нон-стоп'],
  ['Сплин',                    'Выхода Нет'],
  ['Сплин',                    'Линия Жизни'],
  ['Шура/Nirvana',             'Ты не веришь слезам'],
];

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY ? '=== DRY RUN ===' : '=== LIVE ===');

  // 1. Fetch musicians (to know the permanent roster names)
  const musicians = await api('/musicians');
  musicians.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const roster = musicians.map(m => m.name);
  console.log(`Roster: ${roster.join(', ')}`);

  // 2. Fetch all songs
  const songs = await api('/songs');
  console.log(`Fetched ${songs.length} songs from backlog\n`);

  // 3. Update songs: vocals rule + progress
  let vocalsAdded = 0, progressSet = 0;
  for (const song of songs) {
    const k = key(song.artist, song.title);
    const modified = JSON.parse(JSON.stringify(song));
    let changed = false;

    // Vocals rule: if no one sings, add vocals to whoever plays guitar
    const hasVocals = Object.values(modified.musicians).some(r => r.instruments?.includes('vocals'));
    if (!hasVocals) {
      const guitarists = Object.entries(modified.musicians)
        .filter(([, r]) => r.instruments?.includes('guitar'))
        .map(([name]) => name);
      for (const name of guitarists) {
        modified.musicians[name].instruments.push('vocals');
        console.log(`  + vocals → ${name}  [${song.artist} – ${song.title}]`);
        changed = true;
        vocalsAdded++;
      }
    }

    // Progress rule: set all participating permanent musicians to 'ready', skip new/доделать
    if (!SKIP_PROGRESS.has(k)) {
      modified.progress = { ...(modified.progress ?? {}) };
      for (const name of roster) {
        const role = modified.musicians[name];
        if (role?.instruments?.length > 0 && modified.progress[name] !== 'ready') {
          modified.progress[name] = 'ready';
          changed = true;
          progressSet++;
        }
      }
    }

    if (changed && !DRY) {
      await api(`/songs/${song.id}`, { method: 'PUT', body: JSON.stringify(modified) });
      await sleep(80);
    }
  }
  console.log(`\nVocals added to ${vocalsAdded} musician slots across songs`);
  console.log(`Progress set to 'ready' for ${progressSet} musician/song pairs\n`);

  // 4. Re-fetch updated songs (needed for correct snapshot in setlist entries)
  const fresh = DRY ? songs : await api('/songs');

  // 5. Match setlist songs to DB
  const resolved = [];
  const missing = [];
  for (const [artist, title] of SETLIST_ORDER) {
    const s = findSong(fresh, artist, title);
    if (s) { resolved.push(s); }
    else    { missing.push(`${artist} – ${title}`); console.warn(`  ✗ NOT FOUND: "${artist} – ${title}"`); }
  }
  console.log(`Resolved ${resolved.length}/${SETLIST_ORDER.length} songs for setlist`);
  if (missing.length) console.warn(`Missing: ${missing.join('; ')}`);

  // 6. Create setlist
  let setlist;
  if (!DRY) {
    setlist = await api('/setlists', {
      method: 'POST',
      body: JSON.stringify({
        name: 'На полпути из пизды в могилу',
        date: '2025-05-02',
        startTime: '17:00',
      }),
    });
    console.log(`\nCreated setlist: ${setlist.id}`);
  } else {
    console.log('\n[DRY] Would create setlist "На полпути из пизды в могилу" 2025-05-02 17:00');
    return;
  }

  // 7. Add songs to setlist (single batch)
  setlist = await api(`/setlists/${setlist.id}/songs`, {
    method: 'POST',
    body: JSON.stringify({ songs: resolved }),
  });
  console.log(`Added ${resolved.length} songs to setlist`);

  // 8. Add guest musicians to specific entries
  // Re-fetch to get actual entry orders
  setlist = await api(`/setlists/${setlist.id}`);

  let guestEntries = 0;
  for (const entry of setlist.entries) {
    if (!entry.song) continue;
    const k = key(entry.song.artist, entry.song.title);
    const guests = ENTRY_GUESTS[k];
    if (!guests) continue;

    const modSong = JSON.parse(JSON.stringify(entry.song));
    for (const [name, instruments] of Object.entries(guests)) {
      modSong.musicians[name] = { instruments };
    }

    await api(`/setlists/${setlist.id}/entry-song`, {
      method: 'PATCH',
      body: JSON.stringify({ order: entry.order, song: modSong }),
    });
    console.log(`  Guests added to ${entry.song.artist} – ${entry.song.title}: ${Object.keys(guests).join(', ')}`);
    await sleep(80);
    guestEntries++;
  }

  console.log(`\nGuest musicians added to ${guestEntries} entries`);
  console.log('\nDone ✓');
}

main().catch(err => { console.error(err); process.exit(1); });
