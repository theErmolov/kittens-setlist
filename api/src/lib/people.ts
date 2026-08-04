import type { BandMusician, Instrument, User, UserRole, UserStatus } from './types.js';
import {
  dbDelete,
  dbDeleteByKey,
  dbGet,
  dbGetByKey,
  dbPut,
  dbQueryIndex,
  dbScan,
  dbTransactPutAndDelete,
} from './dynamo.js';

export const PEOPLE_TABLE = process.env.PEOPLE_TABLE ?? 'kittens-people';
export const LEGACY_USERS_TABLE = process.env.USERS_TABLE ?? 'kittens-users';
export const LEGACY_MUSICIANS_TABLE = process.env.MUSICIANS_TABLE ?? 'kittens-musicians';
export const PEOPLE_CONTROL_ID = '__people_control__';
export const TELEGRAM_ID_INDEX = 'telegramId-index';

export interface LegacyUser {
  telegramId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  status: UserStatus;
  role?: UserRole;
  musicianId?: string;
  isAdmin?: boolean;
  createdAt: string;
  approvedAt?: string;
}

export interface PeopleControl {
  id: typeof PEOPLE_CONTROL_ID;
  activeStore: 'legacy' | 'people';
  mutationsLocked: boolean;
  updatedAt: string;
}

export function isUserRecord(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<User>;
  return typeof item.id === 'string'
    && item.id !== PEOPLE_CONTROL_ID
    && (typeof item.telegramId === 'string' || typeof item.musicianName === 'string');
}

export function projectMusician(user: User): BandMusician | undefined {
  if (!user.musicianName) return undefined;
  return {
    id: user.id,
    name: user.musicianName,
    ...(user.defaultInstruments ? { defaultInstruments: user.defaultInstruments } : {}),
    ...(user.sortOrder !== undefined ? { sortOrder: user.sortOrder } : {}),
    ...(user.guest !== undefined ? { guest: user.guest } : {}),
  };
}

export function combineLegacyUser(user: LegacyUser, musician?: BandMusician): User {
  return {
    id: musician?.id ?? user.telegramId,
    telegramId: user.telegramId,
    firstName: user.firstName,
    ...(user.lastName ? { lastName: user.lastName } : {}),
    ...(user.username ? { username: user.username } : {}),
    ...(user.photoUrl ? { photoUrl: user.photoUrl } : {}),
    status: user.status,
    ...(user.role ? { role: user.role } : {}),
    ...(user.isAdmin !== undefined ? { isAdmin: user.isAdmin } : {}),
    createdAt: user.createdAt,
    ...(user.approvedAt ? { approvedAt: user.approvedAt } : {}),
    ...(musician ? {
      musicianName: musician.name,
      ...(musician.defaultInstruments ? { defaultInstruments: musician.defaultInstruments } : {}),
      ...(musician.sortOrder !== undefined ? { sortOrder: musician.sortOrder } : {}),
      ...(musician.guest !== undefined ? { guest: musician.guest } : {}),
    } : {}),
  };
}

export function musicianOnlyUser(musician: BandMusician): User {
  return {
    id: musician.id,
    musicianName: musician.name,
    ...(musician.defaultInstruments ? { defaultInstruments: musician.defaultInstruments } : {}),
    ...(musician.sortOrder !== undefined ? { sortOrder: musician.sortOrder } : {}),
    ...(musician.guest !== undefined ? { guest: musician.guest } : {}),
  };
}

export async function getPeopleControl(): Promise<PeopleControl> {
  try {
    const control = await dbGet<PeopleControl>(PEOPLE_TABLE, PEOPLE_CONTROL_ID);
    return control ?? {
      id: PEOPLE_CONTROL_ID,
      activeStore: 'legacy',
      mutationsLocked: false,
      updatedAt: new Date(0).toISOString(),
    };
  } catch (error) {
    if ((error as { name?: string }).name !== 'ResourceNotFoundException') throw error;
    return {
      id: PEOPLE_CONTROL_ID,
      activeStore: 'legacy',
      mutationsLocked: false,
      updatedAt: new Date(0).toISOString(),
    };
  }
}

export async function mutationsAreLocked(): Promise<boolean> {
  return (await getPeopleControl()).mutationsLocked;
}

export async function peopleStoreIsActive(): Promise<boolean> {
  return (await getPeopleControl()).activeStore === 'people';
}

async function legacyMusician(id?: string): Promise<BandMusician | undefined> {
  return id ? dbGet<BandMusician>(LEGACY_MUSICIANS_TABLE, id) : undefined;
}

export async function getUserByTelegramId(telegramId: string): Promise<User | undefined> {
  if (await peopleStoreIsActive()) {
    const matches = await dbQueryIndex<User>(PEOPLE_TABLE, TELEGRAM_ID_INDEX, 'telegramId', telegramId);
    if (matches.length > 1) throw new Error(`Duplicate people records for telegramId ${telegramId}`);
    return matches[0];
  }
  const legacy = await dbGetByKey<LegacyUser>(LEGACY_USERS_TABLE, { telegramId });
  if (!legacy) return undefined;
  return combineLegacyUser(legacy, await legacyMusician(legacy.musicianId));
}

export async function listUsers(): Promise<User[]> {
  if (await peopleStoreIsActive()) {
    return (await dbScan<unknown>(PEOPLE_TABLE)).filter(isUserRecord);
  }

  const [legacyUsers, musicians] = await Promise.all([
    dbScan<LegacyUser>(LEGACY_USERS_TABLE),
    dbScan<BandMusician>(LEGACY_MUSICIANS_TABLE),
  ]);
  const musiciansById = new Map(musicians.map(musician => [musician.id, musician]));
  const linkedIds = new Set(legacyUsers.map(user => user.musicianId).filter((id): id is string => Boolean(id)));
  return [
    ...legacyUsers.map(user => combineLegacyUser(user, user.musicianId ? musiciansById.get(user.musicianId) : undefined)),
    ...musicians.filter(musician => !linkedIds.has(musician.id)).map(musicianOnlyUser),
  ];
}

export async function getUserById(id: string): Promise<User | undefined> {
  if (await peopleStoreIsActive()) return dbGet<User>(PEOPLE_TABLE, id);
  const users = await listUsers();
  return users.find(user => user.id === id || user.telegramId === id);
}

function legacyUserProjection(user: User): LegacyUser | undefined {
  if (!user.telegramId || !user.firstName || !user.status || !user.createdAt) return undefined;
  return {
    telegramId: user.telegramId,
    firstName: user.firstName,
    ...(user.lastName ? { lastName: user.lastName } : {}),
    ...(user.username ? { username: user.username } : {}),
    ...(user.photoUrl ? { photoUrl: user.photoUrl } : {}),
    status: user.status,
    ...(user.role ? { role: user.role } : {}),
    ...(user.musicianName ? { musicianId: user.id } : {}),
    ...(user.isAdmin !== undefined ? { isAdmin: user.isAdmin } : {}),
    createdAt: user.createdAt,
    ...(user.approvedAt ? { approvedAt: user.approvedAt } : {}),
  };
}

async function mirrorToLegacy(user: User, previous?: User): Promise<void> {
  const access = legacyUserProjection(user);
  if (access) await dbPut(LEGACY_USERS_TABLE, access as unknown as Record<string, unknown>);

  const musician = projectMusician(user);
  if (musician) {
    await dbPut(LEGACY_MUSICIANS_TABLE, musician as unknown as Record<string, unknown>);
  } else if (previous?.musicianName) {
    await dbDelete(LEGACY_MUSICIANS_TABLE, previous.id);
  }
}

function assertValidUser(user: User): void {
  if (!user.id || (!user.telegramId && !user.musicianName)) {
    throw new Error('Every user must have an id and at least telegramId or musicianName');
  }
}

export async function saveUser(user: User, previous?: User): Promise<void> {
  assertValidUser(user);
  if (await peopleStoreIsActive()) {
    await dbPut(PEOPLE_TABLE, user as unknown as Record<string, unknown>);
    await mirrorToLegacy(user, previous);
  } else {
    await mirrorToLegacy(user, previous);
    await dbPut(PEOPLE_TABLE, user as unknown as Record<string, unknown>);
  }
}

export async function deleteMusicianOnlyUser(user: User): Promise<void> {
  if (user.telegramId) throw new Error('Cannot delete a user with Telegram access');
  if (await peopleStoreIsActive()) {
    await dbDelete(PEOPLE_TABLE, user.id);
    await dbDelete(LEGACY_MUSICIANS_TABLE, user.id);
  } else {
    await dbDelete(LEGACY_MUSICIANS_TABLE, user.id);
    await dbDelete(PEOPLE_TABLE, user.id);
  }
}

export async function saveMergedUser(user: User, previousTarget: User, sourceId: string): Promise<void> {
  assertValidUser(user);
  const deleteId = sourceId !== user.id ? sourceId : undefined;
  if (await peopleStoreIsActive()) {
    await dbTransactPutAndDelete(PEOPLE_TABLE, user as unknown as Record<string, unknown>, deleteId);
    await mirrorToLegacy(user, previousTarget);
  } else {
    await mirrorToLegacy(user, previousTarget);
    await dbTransactPutAndDelete(PEOPLE_TABLE, user as unknown as Record<string, unknown>, deleteId);
  }
}

export async function listMusicians(): Promise<BandMusician[]> {
  const musicians = !(await peopleStoreIsActive())
    ? await dbScan<BandMusician>(LEGACY_MUSICIANS_TABLE)
    : (await dbScan<unknown>(PEOPLE_TABLE))
      .filter(isUserRecord)
      .map(projectMusician)
      .filter((musician): musician is BandMusician => Boolean(musician));
  return musicians.sort((a, b) =>
    (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
      || a.name.localeCompare(b.name)
  );
}

export function sanitizeInstruments(value: unknown): Instrument[] | undefined {
  if (value === undefined) return undefined;
  const allowed: Instrument[] = ['guitar', 'bass', 'drums', 'keys', 'cajon', 'violin', 'percussion', 'vocals'];
  if (!Array.isArray(value) || value.some(item => !allowed.includes(item as Instrument))) {
    throw new Error('Invalid defaultInstruments');
  }
  return value as Instrument[];
}
