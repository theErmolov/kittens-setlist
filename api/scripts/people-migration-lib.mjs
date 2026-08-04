export const CONTROL_ID = '__people_control__';

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${label}`);
}

function musicianFields(musician) {
  return {
    musicianName: musician.name,
    ...(musician.defaultInstruments !== undefined ? { defaultInstruments: musician.defaultInstruments } : {}),
    ...(musician.sortOrder !== undefined ? { sortOrder: musician.sortOrder } : {}),
    ...(musician.guest !== undefined ? { guest: musician.guest } : {}),
  };
}

export function buildPeople(legacyUsers, musicians, expectedCount) {
  const usersByTelegramId = new Map();
  for (const user of legacyUsers) {
    requireString(user.telegramId, 'user.telegramId');
    requireString(user.firstName, `firstName for Telegram ${user.telegramId}`);
    requireString(user.status, `status for Telegram ${user.telegramId}`);
    requireString(user.createdAt, `createdAt for Telegram ${user.telegramId}`);
    if (usersByTelegramId.has(user.telegramId)) throw new Error(`Duplicate telegramId ${user.telegramId}`);
    usersByTelegramId.set(user.telegramId, user);
  }

  const musiciansById = new Map();
  for (const musician of musicians) {
    requireString(musician.id, 'musician.id');
    requireString(musician.name, `name for musician ${musician.id}`);
    if (musiciansById.has(musician.id)) throw new Error(`Duplicate musician id ${musician.id}`);
    musiciansById.set(musician.id, musician);
  }

  const links = new Map();
  for (const user of legacyUsers) {
    if (!user.musicianId) continue;
    if (!musiciansById.has(user.musicianId)) {
      throw new Error(`User ${user.telegramId} links missing musician ${user.musicianId}`);
    }
    if (links.has(user.musicianId)) {
      throw new Error(`Musician ${user.musicianId} is linked by multiple Telegram users`);
    }
    links.set(user.musicianId, user.telegramId);
  }

  const people = legacyUsers.map(user => {
    const musician = user.musicianId ? musiciansById.get(user.musicianId) : undefined;
    const { musicianId: _legacyLink, ...access } = user;
    return {
      id: musician?.id ?? user.telegramId,
      ...access,
      ...(musician ? musicianFields(musician) : {}),
    };
  });
  for (const musician of musicians) {
    if (!links.has(musician.id)) people.push({ id: musician.id, ...musicianFields(musician) });
  }

  const ids = new Set();
  for (const person of people) {
    if (ids.has(person.id)) throw new Error(`Canonical id collision ${person.id}`);
    ids.add(person.id);
    if (!person.telegramId && !person.musicianName) {
      throw new Error(`Person ${person.id} has neither telegramId nor musicianName`);
    }
  }
  if (expectedCount !== undefined && people.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} people, found ${people.length}`);
  }
  assertRosterParity(people, musicians);
  return people;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function comparable(value) {
  return JSON.stringify(stable(value));
}

export function projectedRoster(people) {
  return people
    .filter(person => person.id !== CONTROL_ID && person.musicianName)
    .map(person => ({
      id: person.id,
      name: person.musicianName,
      ...(person.defaultInstruments !== undefined ? { defaultInstruments: person.defaultInstruments } : {}),
      ...(person.sortOrder !== undefined ? { sortOrder: person.sortOrder } : {}),
      ...(person.guest !== undefined ? { guest: person.guest } : {}),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function assertRosterParity(people, musicians) {
  const source = musicians.map(musician => ({
    id: musician.id,
    name: musician.name,
    ...(musician.defaultInstruments !== undefined ? { defaultInstruments: musician.defaultInstruments } : {}),
    ...(musician.sortOrder !== undefined ? { sortOrder: musician.sortOrder } : {}),
    ...(musician.guest !== undefined ? { guest: musician.guest } : {}),
  })).sort((a, b) => a.id.localeCompare(b.id));
  const projected = projectedRoster(people);
  if (comparable(source) !== comparable(projected)) {
    throw new Error('Projected /musicians roster differs from the legacy roster');
  }
}

export function assertTargetParity(expected, targetItems) {
  const actual = targetItems.filter(item => item.id !== CONTROL_ID).sort((a, b) => a.id.localeCompare(b.id));
  const wanted = [...expected].sort((a, b) => a.id.localeCompare(b.id));
  if (comparable(actual) !== comparable(wanted)) {
    throw new Error('Target people records differ from the validated conversion');
  }
}
