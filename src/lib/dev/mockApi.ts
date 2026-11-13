/**
 * DEV ONLY — an in-browser fake of the backend, so every page (incl. the admin area) can be seen without a login or the real API.
 * Switched on by `VITE_DEV_MOCK=1` in `.env` (see AGENTS.md "Local dev setup") and only ever loaded from `src/hooks.client.ts`
 * behind `import.meta.env.DEV`, so production builds contain none of it. Writes are acknowledged but not persisted (users are kept in memory).
 */
import { PUBLIC_API_URL } from '$env/static/public';
import type { AuditLogEntry, BandMusician, BudgetEntry, PresenceEntry, Rehearsal, Setlist, Song, User } from '$lib/types';

/** A copy of the real data (`npm run mock:snapshot`, git-ignored). When present it replaces the built-in sample data below. */
interface Snapshot { takenAt: string; me: User; users: User[]; musicians: BandMusician[]; songs: Song[]; setlists: Setlist[]; rehearsals: Rehearsal[]; budget: BudgetEntry[]; audit: AuditLogEntry[]; notificationPreferences: { enabled: boolean }; presence?: PresenceEntry[]; generated?: string[] }
const snapshot = Object.values(import.meta.glob('./mock-data.json', { eager: true, import: 'default' }))[0] as Snapshot | undefined;

const iso = (daysFromNow: number, time = '20:00') => {
  const d = new Date(Date.now() + daysFromNow * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}${time ? `T${time}:00.000Z` : ''}`;
};
const day = (n: number) => iso(n, '').slice(0, 10);

const sampleMe: User = { id: 'u-admin', telegramId: '1', firstName: 'Mock', lastName: 'Admin', username: 'mock_admin', status: 'approved', role: 'writer', isAdmin: true, createdAt: iso(-90), approvedAt: iso(-90) };

let sampleUsers: User[] = [
  sampleMe,
  { id: 'u2', telegramId: '2', firstName: 'Илья', username: 'ilya', status: 'approved', role: 'writer', musicianName: 'Илья', defaultInstruments: ['guitar'], createdAt: iso(-80), approvedAt: iso(-79) },
  { id: 'u3', telegramId: '3', firstName: 'Андрей', username: 'andrey', status: 'approved', role: 'writer', musicianName: 'Андрей', defaultInstruments: ['vocals', 'guitar'], createdAt: iso(-70), approvedAt: iso(-69) },
  { id: 'u4', telegramId: '4', firstName: 'Тоня', status: 'approved', role: 'reader', musicianName: 'Тоня', defaultInstruments: ['keys'], createdAt: iso(-40), approvedAt: iso(-39) },
  { id: 'u5', telegramId: '5', firstName: 'Маша', username: 'masha', status: 'pending', createdAt: iso(-2) },
  { id: 'u6', telegramId: '6', firstName: 'Игорь', status: 'pending', createdAt: iso(-1) },
  { id: 'u7', telegramId: '7', firstName: 'Спамер', status: 'rejected', createdAt: iso(-20) },
];

const sampleMusicians: BandMusician[] = ['Илья', 'Андрей', 'iL\'Ja', 'Тоня', 'Маша', 'Мих'].map((name, i) => ({ id: `m${i}`, name, sortOrder: i, defaultInstruments: [(['guitar', 'vocals', 'bass', 'keys', 'drums', 'saxophone'] as const)[i]] }));

const song = (i: number, artist: string, title: string, category: Song['category']): Song => ({
  id: `s${i}`, artist, title, category, lengthMinutes: 3 + (i % 4),
  musicians: { 'Илья': { instruments: ['guitar'] }, 'Андрей': { instruments: ['vocals'] }, 'Тоня': { instruments: ['keys'] }, ...(i % 2 ? { 'Маша': { instruments: ['drums'] } } : {}), ...(i % 3 === 0 ? { 'Гость Юра': { instruments: ['saxophone'] } } : {}) },
  progress: { 'Илья': 'ready', 'Андрей': i % 2 ? 'mastering' : 'ready', 'Тоня': 'structure', 'Маша': 'queue' },
});
const sampleSongs: Song[] = [
  song(1, 'Кино', 'Группа крови', 'top'), song(2, 'Агата Кристи', 'Черная Луна', 'mid'), song(3, 'Сплин', 'Выхода нет', 'mid'),
  song(4, 'Наутилус', 'Крылья', 'low'), song(5, 'ДДТ', 'Осень', 'top'), song(6, 'Би-2', 'Полковнику никто не пишет', 'mid'),
];

const sampleSetlists: Setlist[] = [
  { id: 'sl1', name: 'Хэллоуин', date: day(6), startTime: '20:00', vibe: true, comment: 'Привезти кабели', subsets: [{ id: 'ss1', name: 'Мини-сет 1' }],
    entries: sampleSongs.slice(0, 4).map((s, i) => ({ songId: s.id, song: s, order: i, played: false, ...(i < 2 ? { subsetId: 'ss1' } : {}) })) },
  { id: 'sl2', name: 'Клуб', date: day(-12), startTime: '21:00', vibe: false, subsets: [], entries: sampleSongs.slice(2, 6).map((s, i) => ({ songId: s.id, song: s, order: i, played: true })) },
  { id: 'sl3', name: 'Репетиционный сет', subsets: [], entries: sampleSongs.slice(0, 2).map((s, i) => ({ songId: s.id, song: s, order: i, played: false })) },
] as Setlist[];

const sampleRehearsals: Rehearsal[] = [
  { id: 'r1', date: day(2), startTime: '19:00', timeZone: 'Europe/Berlin', location: 'Студия 5', note: 'Принести ноты', setlistId: 'sl1', attendees: ['Илья', 'Андрей', 'Тоня'], cancelled: false, version: 1, createdAt: iso(-3), createdBy: '1',
    songs: sampleSongs.slice(0, 3).map((s, i) => ({ songId: s.id, sourceSetlistId: 'sl1', song: s, played: i === 0 })) },
  { id: 'r2', date: day(-5), startTime: '19:00', timeZone: 'Europe/Berlin', attendees: ['Илья', 'Маша'], cancelled: true, version: 2, createdAt: iso(-9), createdBy: '1', songs: [] },
] as Rehearsal[];

const sampleAudit: AuditLogEntry[] = [
  ['create', 'song', 'Группа крови', 'Добавлена песня'], ['update', 'song', 'Черная Луна', 'Изменён комментарий'], ['create', 'setlist', 'Хэллоуин', 'Создан сетлист'],
  ['update', 'user', 'Маша', 'Статус: pending'], ['create', 'rehearsal', 'Студия 5', 'Запланирована репетиция'], ['create', 'budget', 'Аренда зала', 'Расход 120 €'],
].map(([action, entityType, entityName, summary], i) => ({
  sk: `a${i}`, timestamp: iso(-i, `${String(10 + i).padStart(2, '0')}:15`), action, actorTelegramId: '1', actorName: 'Mock Admin',
  entityType: entityType as AuditLogEntry['entityType'], entityId: `e${i}`, entityName, summary,
}));

const sampleBudget: BudgetEntry[] = [
  { id: 'b1', kind: 'income', amount: 25000, method: 'cash', person: 'Клуб «Лофт»', date: iso(-12), comment: 'Гонорар', setlistId: 'sl2', createdAt: iso(-12), createdBy: '1' },
  { id: 'b2', kind: 'expense', amount: 12000, method: 'transfer', spentBy: 'Илья', description: 'Аренда студии', date: iso(-10), createdAt: iso(-10), createdBy: '1' },
  { id: 'b3', kind: 'debt', amount: 4500, creditor: 'Город', description: 'Налог на мероприятие', paid: false, date: iso(-4), createdAt: iso(-4), createdBy: '1' },
  { id: 'b4', kind: 'debt', amount: 2000, creditor: 'Звукорежиссёр', paid: true, paidAt: iso(-1), date: iso(-8), createdAt: iso(-8), createdBy: '1' },
  { id: 'b5', kind: 'income', amount: 8000, method: 'transfer', person: 'Донат', date: iso(-2), createdAt: iso(-2), createdBy: '1' },
] as BudgetEntry[];

const D = {
  // Mock mode is for seeing everything, so the mock user is always an admin (the real account in a snapshot may not be one).
  me: { ...(snapshot?.me ?? sampleMe), isAdmin: true },
  users: snapshot?.users ?? sampleUsers,
  musicians: snapshot?.musicians ?? sampleMusicians,
  songs: snapshot?.songs ?? sampleSongs,
  setlists: snapshot?.setlists ?? sampleSetlists,
  rehearsals: snapshot?.rehearsals ?? sampleRehearsals,
  audit: snapshot?.audit ?? sampleAudit,
  budget: snapshot?.budget ?? sampleBudget,
  notificationPreferences: snapshot?.notificationPreferences ?? { enabled: true },
  presence: snapshot?.presence,
};

/** Everyone in the (snapshot or sample) list counts as online right now: the timestamps are refreshed on every request, so entries never expire. */
const presence = (): PresenceEntry[] => (D.presence ?? SAMPLE_PRESENCE).map((p, i) => ({
  ...p, lastSeen: new Date(Date.now() - i * 15_000).toISOString(), expiresAt: Math.floor(Date.now() / 1000) + 60,
}));
const SAMPLE_PRESENCE: PresenceEntry[] = [
  { room: 'backlog', clientId: 'c1', userId: 'u2', name: 'Илья', canMark: true, lastSeen: new Date().toISOString(), expiresAt: Math.floor(Date.now() / 1000) + 60 },
  { room: 'setlist:sl1', clientId: 'c2', userId: 'u3', name: 'Андрей', canMark: true, lastSeen: new Date(Date.now() - 20_000).toISOString(), expiresAt: Math.floor(Date.now() / 1000) + 60 },
  { room: 'setlist:sl1', clientId: 'c3', name: 'гость', canMark: false, lastSeen: new Date(Date.now() - 50_000).toISOString(), expiresAt: Math.floor(Date.now() / 1000) + 40 },
];

function route(method: string, path: string, url: URL, body: unknown): unknown {
  const seg = path.split('/').filter(Boolean);
  if (path === '/auth/me') return D.me;
  if (path === '/auth/users' && method === 'GET') return D.users;
  if (seg[0] === 'auth' && seg[1] === 'users' && method === 'PATCH') {
    D.users = D.users.map(u => (u.id === decodeURIComponent(seg[2]) ? { ...u, ...(body as Partial<User>) } : u));
    return D.users.find(u => u.id === decodeURIComponent(seg[2]));
  }
  if (path === '/auth/audit-log') return { items: D.audit, nextCursor: undefined };
  if (path === '/online-presence') return presence();
  if (seg[0] === 'presence') return { others: presence().filter(p => p.room === decodeURIComponent(seg[1] ?? '')) };
  if (path === '/musicians') return D.musicians;
  if (path === '/songs') return D.songs;
  if (seg[0] === 'songs' && seg[1]) return D.songs.find(s => s.id === seg[1]) ?? D.songs[0];
  if (path === '/setlists') return D.setlists;
  if (seg[0] === 'setlists' && seg[1]) return D.setlists.find(s => s.id === seg[1]) ?? D.setlists[0];
  if (path === '/rehearsals') return D.rehearsals;
  if (seg[0] === 'rehearsals' && seg[1]) return D.rehearsals.find(r => r.id === seg[1]) ?? D.rehearsals[0];
  if (path === '/budget') return D.budget;
  if (seg[0] === 'budget' && seg[2] === 'receipt-url') return { url: 'about:blank' };
  if (path === '/notification-preferences') return D.notificationPreferences;
  return {};
}

const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!raw.startsWith(PUBLIC_API_URL)) return nativeFetch(input, init);
  const url = new URL(raw);
  const path = url.pathname.replace(/^\/[^/]+(?=\/(auth|songs|setlists|musicians|rehearsals|budget|presence|online-presence|notification-preferences))/, '');
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
  let body: unknown;
  try { body = init?.body ? JSON.parse(String(init.body)) : undefined; } catch { body = undefined; }
  await new Promise(r => setTimeout(r, 120));
  return new Response(JSON.stringify(route(method, path, url, body)), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
// A token must exist for the auth guard to ask `/auth/me`.
if (!localStorage.getItem('auth_token') || localStorage.getItem('auth_token') === 'invalid') localStorage.setItem('auth_token', 'dev-mock');
console.info(`[dev] mock API enabled (VITE_DEV_MOCK=1) — ${snapshot ? 'serving the real-data snapshot from ' + snapshot.takenAt + (snapshot.generated?.length ? ' (generated: ' + snapshot.generated.join(', ') + ')' : '') : 'serving built-in sample data (run `npm run mock:snapshot` for a copy of the real data)'}`);
