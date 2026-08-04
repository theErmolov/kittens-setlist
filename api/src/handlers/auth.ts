import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { ok, err } from '../lib/response.js';
import { dbDeleteByKey, dbGetByKey, dbPut } from '../lib/dynamo.js';
import { verifyTelegramAuth, type TelegramAuthData } from '../lib/telegram.js';
import type { Instrument, KittensSession, User, UserRole, UserStatus } from '../lib/types.js';
import {
  getUserById,
  getUserByTelegramId,
  listUsers,
  mutationsAreLocked,
  sanitizeInstruments,
  saveMergedUser,
  saveUser,
} from '../lib/people.js';
import { logAudit, queryAuditLog } from '../lib/audit.js';
import { mergeUserRecords, refreshTelegramIdentity, removeMusicianFields } from '../lib/people-domain.js';

const SESSIONS_TABLE = process.env.SESSIONS_TABLE ?? 'kittens-sessions';
const SESSION_TTL_SECONDS = 180 * 24 * 60 * 60;

interface UserPatch {
  status?: UserStatus;
  role?: UserRole | null;
  musicianName?: string | null;
  defaultInstruments?: Instrument[];
  sortOrder?: number;
  guest?: boolean;
  mergeIntoUserId?: string;
}

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');
  return token;
}

async function getSession(token: string): Promise<KittensSession | undefined> {
  const session = await dbGetByKey<KittensSession>(SESSIONS_TABLE, { token });
  if (!session || session.expiresAt < Math.floor(Date.now() / 1000)) return undefined;
  return session;
}

async function sessionFromEvent(event: APIGatewayProxyEventV2): Promise<KittensSession | undefined> {
  const authHeader = event.headers?.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  return token ? getSession(token) : undefined;
}

async function adminFromEvent(event: APIGatewayProxyEventV2): Promise<User | undefined> {
  const session = await sessionFromEvent(event);
  return session ? getUserByTelegramId(session.telegramId) : undefined;
}

function displayName(user: User): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.musicianName || user.id;
}

function parsePatch(body: string | null | undefined): UserPatch {
  const patch = JSON.parse(body ?? '{}') as UserPatch;
  if (patch.status !== undefined && !['pending', 'approved', 'rejected'].includes(patch.status)) {
    throw new Error('Invalid status');
  }
  if (patch.role !== undefined && patch.role !== null && !['writer', 'reader'].includes(patch.role)) {
    throw new Error('Invalid role');
  }
  if (patch.musicianName !== undefined && patch.musicianName !== null && !patch.musicianName.trim()) {
    throw new Error('musicianName cannot be empty');
  }
  patch.defaultInstruments = sanitizeInstruments(patch.defaultInstruments);
  if (patch.sortOrder !== undefined && !Number.isFinite(patch.sortOrder)) throw new Error('Invalid sortOrder');
  if (patch.mergeIntoUserId && patch.musicianName !== undefined) {
    throw new Error('Cannot merge and replace musician fields in one request');
  }
  return patch;
}

export async function resolveAuth(event: APIGatewayProxyEventV2): Promise<User | null> {
  const session = await sessionFromEvent(event);
  if (!session) return null;
  return (await getUserByTelegramId(session.telegramId)) ?? null;
}

export async function authHandler(event: APIGatewayProxyEventV2, path: string): Promise<unknown> {
  const method = event.requestContext.http.method;

  if (method === 'POST' && path === '/auth/telegram') {
    if (await mutationsAreLocked()) return err('People migration in progress', 423);

    let data: TelegramAuthData;
    try {
      data = JSON.parse(event.body ?? '{}') as TelegramAuthData;
    } catch {
      return err('Invalid JSON', 400);
    }
    data = { ...data, id: String(data.id) };
    if (!data.id || !data.hash || !data.auth_date || !data.first_name) {
      return err('Missing required Telegram auth fields', 400);
    }

    let valid: boolean;
    try {
      valid = verifyTelegramAuth(data, getBotToken());
    } catch {
      return err('Server configuration error', 500);
    }
    if (!valid) return err('Invalid or expired Telegram auth data', 401);

    const existing = await getUserByTelegramId(data.id);
    const now = new Date().toISOString();
    const user = refreshTelegramIdentity(existing, {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      username: data.username,
      photoUrl: data.photo_url,
    }, now);
    await saveUser(user, existing);

    const token = randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    const session: KittensSession = { token, telegramId: data.id, expiresAt };
    await dbPut(SESSIONS_TABLE, session as unknown as Record<string, unknown>);
    return ok({ token, user });
  }

  if (method === 'GET' && path === '/auth/me') {
    const session = await sessionFromEvent(event);
    if (!session) return err('Session expired or invalid', 401);
    const user = await getUserByTelegramId(session.telegramId);
    return user ? ok(user) : err('User not found', 404);
  }

  if (method === 'DELETE' && path === '/auth/logout') {
    const authHeader = event.headers?.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return err('Unauthorized', 401);
    await dbDeleteByKey(SESSIONS_TABLE, { token });
    return ok({ ok: true });
  }

  if (method === 'GET' && path === '/auth/users') {
    const caller = await adminFromEvent(event);
    if (!caller) return err('Unauthorized', 401);
    if (!caller.isAdmin) return err('Forbidden', 403);
    return ok(await listUsers());
  }

  if (method === 'PATCH' && path.startsWith('/auth/users/')) {
    if (await mutationsAreLocked()) return err('People migration in progress', 423);
    const id = decodeURIComponent(path.slice('/auth/users/'.length));
    if (!id) return err('Missing user id', 400);

    const caller = await adminFromEvent(event);
    if (!caller) return err('Unauthorized', 401);
    if (!caller.isAdmin) return err('Forbidden', 403);
    const source = await getUserById(id);
    if (!source) return err('User not found', 404);

    let patch: UserPatch;
    try {
      patch = parsePatch(event.body);
    } catch (error) {
      return err((error as Error).message || 'Invalid JSON', 400);
    }

    let auditBefore = source;
    let storageBefore = source;
    let user = source;
    let mergeTarget: User | undefined;
    if (patch.mergeIntoUserId) {
      const target = await getUserById(patch.mergeIntoUserId);
      if (!target) return err('Merge target not found', 404);
      try {
        user = mergeUserRecords(source, target);
      } catch (error) {
        return err((error as Error).message, 400);
      }
      storageBefore = target;
      mergeTarget = target;
    }

    const removingMusician = patch.musicianName === null && Boolean(user.musicianName);
    const patched: User = {
      ...user,
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.status === 'approved' && user.status !== 'approved' ? { approvedAt: new Date().toISOString() } : {}),
      ...(patch.role !== undefined ? { role: patch.role ?? undefined } : {}),
      ...(patch.musicianName !== undefined
        ? patch.musicianName === null
          ? {}
          : { musicianName: patch.musicianName.trim() }
        : {}),
      ...(patch.defaultInstruments !== undefined ? { defaultInstruments: patch.defaultInstruments } : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
      ...(patch.guest !== undefined ? { guest: patch.guest } : {}),
    };
    const updated = patch.musicianName === null ? removeMusicianFields(patched) : patched;
    try {
      if (mergeTarget) await saveMergedUser(updated, mergeTarget, source.id);
      else await saveUser(updated, storageBefore);
    } catch (error) {
      return err((error as Error).message, 400);
    }

    const name = displayName(updated);
    if (mergeTarget) {
      await logAudit({
        action: 'user.merge', actor: caller, entityType: 'user', entityId: updated.id,
        entityName: name, summary: `объединены пользователи ${source.id} → ${mergeTarget.id}`,
      });
    }
    if (patch.status !== undefined && patch.status !== auditBefore.status) {
      await logAudit({
        action: patch.status === 'approved' ? 'user.approve' : 'user.reject',
        actor: caller,
        entityType: 'user',
        entityId: updated.id,
        entityName: name,
        summary: `статус: ${auditBefore.status ?? '—'} → ${patch.status}`,
      });
    }
    if (patch.role !== undefined && patch.role !== (auditBefore.role ?? null)) {
      await logAudit({
        action: 'user.role_change', actor: caller, entityType: 'user', entityId: updated.id,
        entityName: name, summary: `роль: ${auditBefore.role ?? 'reader'} → ${patch.role ?? 'reader'}`,
      });
    }
    if (removingMusician) {
      await logAudit({
        action: 'user.musician_remove', actor: caller, entityType: 'user', entityId: updated.id,
        entityName: name, summary: `удалён статус музыканта "${auditBefore.musicianName}"`,
      });
    }
    return ok(updated);
  }

  if (method === 'GET' && path === '/auth/audit-log') {
    const caller = await adminFromEvent(event);
    if (!caller) return err('Unauthorized', 401);
    if (!caller.isAdmin) return err('Forbidden', 403);
    const params = event.queryStringParameters ?? {};
    const limitRaw = parseInt(params.limit ?? '20', 10);
    const limit = [20, 50, 100].includes(limitRaw) ? limitRaw : 20;
    return ok(await queryAuditLog(limit, params.cursor ?? undefined));
  }

  return err('Not found', 404);
}
