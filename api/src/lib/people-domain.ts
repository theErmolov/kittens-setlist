import type { User } from './types.js';

export interface TelegramIdentity {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
}

export function refreshTelegramIdentity(existing: User | undefined, identity: TelegramIdentity, now: string): User {
  return {
    ...existing,
    id: existing?.id ?? identity.id,
    telegramId: identity.id,
    firstName: identity.firstName,
    lastName: identity.lastName || undefined,
    username: identity.username || undefined,
    photoUrl: identity.photoUrl || undefined,
    status: existing?.status ?? 'pending',
    createdAt: existing?.createdAt ?? now,
  };
}

export function mergeUserRecords(source: User, target: User): User {
  if (!source.telegramId) throw new Error('Source user has no Telegram identity');
  if (!target.musicianName) throw new Error('Merge target is not a musician');
  if (target.telegramId && target.telegramId !== source.telegramId) {
    throw new Error('Merge target already has Telegram access');
  }
  return {
    ...target,
    telegramId: source.telegramId,
    ...(source.firstName ? { firstName: source.firstName } : {}),
    ...(source.lastName ? { lastName: source.lastName } : {}),
    ...(source.username ? { username: source.username } : {}),
    ...(source.photoUrl ? { photoUrl: source.photoUrl } : {}),
    ...(source.status ? { status: source.status } : {}),
    ...(source.role ? { role: source.role } : {}),
    ...(source.isAdmin !== undefined ? { isAdmin: source.isAdmin } : {}),
    ...(source.createdAt ? { createdAt: source.createdAt } : {}),
    ...(source.approvedAt ? { approvedAt: source.approvedAt } : {}),
  };
}

export function removeMusicianFields(user: User): User {
  return {
    ...user,
    musicianName: undefined,
    defaultInstruments: undefined,
    sortOrder: undefined,
    guest: undefined,
  };
}
