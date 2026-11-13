/**
 * Random-but-plausible data for the dev mock (`npm run mock:snapshot`): used for every category the backend returned nothing for.
 * Generated data is built from what WAS fetched (musician names, song ids, setlist ids…), so it is consistent with the real data.
 * Deterministic (seeded), so repeated snapshots do not reshuffle.
 */

/** Small seeded PRNG (mulberry32). */
export function rng(seed = 20260101) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
    shuffle: arr => arr.map(v => [next(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]),
  };
}

const NAMES = ['Илья', 'Андрей', 'Тоня', 'Маша', 'Мих', 'Биба', 'Саня', 'Кирилл', 'Денис', 'Юра'];
const SONGS = [
  ['Кино', 'Группа крови'], ['Кино', 'Звезда по имени Солнце'], ['Агата Кристи', 'Черная Луна'], ['Сплин', 'Выхода нет'], ['Наутилус Помпилиус', 'Крылья'],
  ['ДДТ', 'Осень'], ['Би-2', 'Полковнику никто не пишет'], ['Ленинград', 'Экспонат'], ['Мумий Тролль', 'Невесты'], ['Земфира', 'Искала'],
  ['Гражданская оборона', 'Всё идёт по плану'], ['Král', 'Prázdniny'],
];
const INSTRUMENTS = ['vocals', 'guitar', 'bass', 'keys', 'drums', 'saxophone', 'violin', 'trumpet', 'cajon', 'percussion'];
const STAGES = ['queue', 'structure', 'mastering', 'ready'];
const PLACES = ['Студия 5', 'Репетиционная база', 'Клуб «Лофт»', 'Бар у Саши', 'Дом культуры'];
const SETLIST_NAMES = ['Хэллоуин', 'Клуб', 'Бар', 'День рождения', 'Акустика', 'Корпоратив'];

const pad = n => String(n).padStart(2, '0');
export const isoDay = (offset, now = new Date()) => { const d = new Date(now.getTime() + offset * 86_400_000); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const isoTime = (offset, hh = 20, mm = 0, now = new Date()) => `${isoDay(offset, now)}T${pad(hh)}:${pad(mm)}:00.000Z`;

export function genMusicians(r = rng(1)) {
  return r.shuffle(NAMES).slice(0, 6).map((name, i) => ({ id: `mock-m${i}`, name, sortOrder: i, defaultInstruments: [INSTRUMENTS[i % INSTRUMENTS.length]] }));
}

export function genSongs(musicians, r = rng(2), count = 14) {
  const names = musicians.map(m => m.name);
  return Array.from({ length: count }, (_, i) => {
    const [artist, title] = SONGS[i % SONGS.length];
    const players = r.shuffle(names).slice(0, r.int(3, Math.min(5, names.length)));
    const song = {
      id: `mock-s${i}`, artist, title: i >= SONGS.length ? `${title} (${i})` : title, category: r.pick(['top', 'mid', 'mid', 'low']),
      lengthMinutes: r.int(3, 7), comment: r.chance(0.25) ? 'Сыграть быстрее' : '', musicians: {}, progress: {},
    };
    for (const n of players) {
      song.musicians[n] = { instruments: [r.pick(INSTRUMENTS)] };
      song.progress[n] = r.pick(STAGES);
    }
    if (r.chance(0.25)) song.musicians['Гость Юра'] = { instruments: ['saxophone'] };
    return song;
  });
}

export function genSetlists(songs, r = rng(3)) {
  return SETLIST_NAMES.slice(0, 4).map((name, i) => {
    const chosen = r.shuffle(songs).slice(0, Math.min(songs.length, r.int(5, 9)));
    const past = i >= 2;
    return {
      id: `mock-sl${i}`, name, date: i === 3 ? undefined : isoDay(past ? -10 * i : 4 + 7 * i), startTime: '20:00', vibe: r.chance(0.4),
      comment: r.chance(0.5) ? 'Привезти кабели' : undefined,
      subsets: i === 0 ? [{ id: 'mock-ss0', name: 'Мини-сет 1' }] : [],
      entries: chosen.map((song, k) => ({ songId: song.id, song, order: k, played: past, ...(i === 0 && k < 2 ? { subsetId: 'mock-ss0' } : {}) })),
    };
  });
}

export function genUsers(musicians, me, r = rng(4)) {
  const users = musicians.slice(0, 4).map((m, i) => ({
    id: `mock-u${i}`, telegramId: String(1000 + i), firstName: m.name, username: m.name.toLowerCase(), status: 'approved', role: i < 2 ? 'writer' : 'reader',
    musicianName: m.name, defaultInstruments: m.defaultInstruments ?? [], createdAt: isoTime(-80 + i), approvedAt: isoTime(-79 + i),
  }));
  users.push({ id: 'mock-u-p1', telegramId: '2001', firstName: 'Новичок', username: 'newbie', status: 'pending', createdAt: isoTime(-1) });
  users.push({ id: 'mock-u-p2', telegramId: '2002', firstName: 'Спамер', status: 'rejected', createdAt: isoTime(-20) });
  return me ? [me, ...users] : users;
}

export function genRehearsals(setlists, songs, musicians, r = rng(5)) {
  const base = (id, offset, extra) => ({
    id, date: isoDay(offset), startTime: '19:00', timeZone: 'Europe/Berlin', location: r.pick(PLACES), setlistId: setlists[0]?.id,
    attendees: r.shuffle(musicians.map(m => m.name)).slice(0, Math.max(2, musicians.length - 2)), cancelled: false, version: 1, createdAt: isoTime(offset - 5), createdBy: '1',
    songs: r.shuffle(songs).slice(0, r.int(3, 5)).map(song => ({ songId: song.id, sourceSetlistId: setlists[0]?.id, song, played: offset < 0 })), ...extra,
  });
  return [base('mock-r0', 2, { note: 'Принести ноты' }), base('mock-r1', 9, {}), base('mock-r2', -6, {}), base('mock-r3', -13, { cancelled: true, songs: [] })];
}

export function genBudget(setlists, musicians, r = rng(6)) {
  const names = musicians.map(m => m.name);
  const common = (id, offset) => ({ id, date: isoTime(offset), createdAt: isoTime(offset), createdBy: '1', ...(r.chance(0.5) && setlists.length ? { setlistId: r.pick(setlists).id } : {}) });
  return [
    { ...common('mock-b0', -12), kind: 'income', amount: r.int(150, 400) * 100, method: 'cash', person: 'Клуб «Лофт»', comment: 'Гонорар' },
    { ...common('mock-b1', -10), kind: 'expense', amount: r.int(40, 150) * 100, method: 'transfer', spentBy: r.pick(names), description: 'Аренда студии' },
    { ...common('mock-b2', -8), kind: 'expense', amount: r.int(10, 60) * 100, method: 'cash', spentBy: r.pick(names), description: 'Струны и кабели' },
    { ...common('mock-b3', -6), kind: 'income', amount: r.int(20, 120) * 100, method: 'transfer', person: 'Донат' },
    { ...common('mock-b4', -4), kind: 'debt', amount: r.int(20, 90) * 100, creditor: 'Город', description: 'Налог на мероприятие', paid: false },
    { ...common('mock-b5', -3), kind: 'debt', amount: r.int(10, 50) * 100, creditor: 'Звукорежиссёр', paid: true, paidAt: isoTime(-1) },
  ];
}

export function genAudit(songs, setlists, musicians, r = rng(7)) {
  const actor = musicians[0]?.name ?? 'Admin';
  const entries = [
    ...songs.slice(0, 4).map(s => ['create', 'song', s.id, `${s.artist} – ${s.title}`, 'Добавлена песня']),
    ...setlists.slice(0, 3).map(s => ['create', 'setlist', s.id, s.name, 'Создан сетлист']),
    ...songs.slice(4, 7).map(s => ['update', 'song', s.id, `${s.artist} – ${s.title}`, 'Изменён комментарий']),
    ['update', 'user', 'mock-u-p1', 'Новичок', 'Статус: pending'],
  ];
  return entries.map(([action, entityType, entityId, entityName, summary], i) => ({
    sk: `mock-a${i}`, timestamp: isoTime(-i, 9 + r.int(0, 10), r.int(0, 59)), action, actorTelegramId: '1', actorName: actor, entityType, entityId, entityName, summary,
  }));
}

export function genPresence(users, setlists, r = rng(8)) {
  const people = users.filter(u => u.status === 'approved').slice(0, 3);
  return people.map((u, i) => ({
    room: i === 0 ? 'backlog' : `setlist:${r.pick(setlists)?.id ?? 'x'}`, clientId: `mock-c${i}`, userId: u.id, name: u.firstName ?? u.username ?? 'user', canMark: u.role === 'writer' || !!u.isAdmin,
    lastSeen: new Date(Date.now() - i * 20_000).toISOString(), expiresAt: Math.floor(Date.now() / 1000) + 60,
  }));
}

/**
 * Fills every empty category of `fetched` with generated data (in dependency order) and reports which were generated.
 * `fetched` = { me, users?, musicians?, songs?, setlists?, rehearsals?, budget?, audit?, notificationPreferences? }, any of them missing/empty.
 */
export function fillMissing(fetched) {
  const generated = [];
  const fill = (key, make) => { const v = fetched[key]; if (Array.isArray(v) ? v.length === 0 : v == null) { fetched[key] = make(); generated.push(key); } };
  fill('musicians', () => genMusicians());
  fill('songs', () => genSongs(fetched.musicians));
  fill('setlists', () => genSetlists(fetched.songs));
  // users: the logged-in admin alone does not make a useful user list
  if (!fetched.users || fetched.users.filter(u => u.id !== fetched.me?.id).length === 0) { fetched.users = genUsers(fetched.musicians, fetched.me); generated.push('users'); }
  fill('rehearsals', () => genRehearsals(fetched.setlists, fetched.songs, fetched.musicians));
  fill('budget', () => genBudget(fetched.setlists, fetched.musicians));
  fill('audit', () => genAudit(fetched.songs, fetched.setlists, fetched.musicians));
  fill('notificationPreferences', () => ({ enabled: true }));
  fetched.presence = genPresence(fetched.users, fetched.setlists); // the real "online" list is never fetched
  return generated;
}
