import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { ok, err } from '../lib/response.js';
import { dbGetByKey, dbDeleteByKey, dbPut, dbScan } from '../lib/dynamo.js';
import { verifyTelegramAuth, type TelegramAuthData } from '../lib/telegram.js';
import type { KittensUser, KittensSession } from '../lib/types.js';

const USERS_TABLE = 'kittens-users';
const SESSIONS_TABLE = 'kittens-sessions';
const SESSION_TTL_SECONDS = 180 * 24 * 60 * 60; // 180 days

function getBotToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN not set');
  return t;
}


async function getSession(token: string): Promise<KittensSession | undefined> {
  const session = await dbGetByKey<KittensSession>(SESSIONS_TABLE, { token });
  if (!session) return undefined;
  if (session.expiresAt < Math.floor(Date.now() / 1000)) return undefined;
  return session;
}

async function getUser(telegramId: string): Promise<KittensUser | undefined> {
  return dbGetByKey<KittensUser>(USERS_TABLE, { telegramId });
}

export async function resolveAuth(event: APIGatewayProxyEventV2): Promise<KittensUser | null> {
  const authHeader = event.headers?.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const session = await getSession(token);
  if (!session) return null;
  const user = await getUser(session.telegramId);
  return user ?? null;
}

export async function authHandler(event: APIGatewayProxyEventV2, path: string): Promise<unknown> {
  const method = event.requestContext.http.method;

  // POST /auth/telegram — verify Telegram data, upsert user, return session token
  if (method === 'POST' && path === '/auth/telegram') {
    let data: TelegramAuthData;
    try {
      data = JSON.parse(event.body ?? '{}') as TelegramAuthData;
    } catch {
      return err('Invalid JSON', 400);
    }

    // Telegram widget passes id as a number — coerce to string for DynamoDB key
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

    // Upsert user — preserve existing status/musicianId if already approved
    const existing = await getUser(data.id);
    const now = new Date().toISOString();
    const user: KittensUser = {
      telegramId: data.id,
      firstName: data.first_name,
      ...(data.last_name ? { lastName: data.last_name } : {}),
      ...(data.username ? { username: data.username } : {}),
      ...(data.photo_url ? { photoUrl: data.photo_url } : {}),
      status: existing?.status ?? 'pending',
      ...(existing?.musicianId ? { musicianId: existing.musicianId } : {}),
      isAdmin: existing?.isAdmin,
      ...(existing?.role ? { role: existing.role } : {}),
      createdAt: existing?.createdAt ?? now,
      ...(existing?.approvedAt ? { approvedAt: existing.approvedAt } : {}),
    };
    await dbPut(USERS_TABLE, user as unknown as Record<string, unknown>);

    // Create session
    const token = randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    const session: KittensSession = { token, telegramId: data.id, expiresAt };
    await dbPut(SESSIONS_TABLE, session as unknown as Record<string, unknown>);

    return ok({ token, user });
  }

  // GET /auth/me — return current user
  if (method === 'GET' && path === '/auth/me') {
    const authHeader = event.headers?.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return err('Unauthorized', 401);
    const session = await getSession(token);
    if (!session) return err('Session expired or invalid', 401);
    const user = await getUser(session.telegramId);
    if (!user) return err('User not found', 404);
    return ok(user);
  }

  // DELETE /auth/logout — delete session
  if (method === 'DELETE' && path === '/auth/logout') {
    const authHeader = event.headers?.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return err('Unauthorized', 401);
    await dbDeleteByKey(SESSIONS_TABLE, { token });
    return ok({ ok: true });
  }

  // GET /auth/users — admin only: list all users
  if (method === 'GET' && path === '/auth/users') {
    const authHeader = event.headers?.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return err('Unauthorized', 401);
    const session = await getSession(token);
    if (!session) return err('Session expired or invalid', 401);
    const caller = await getUser(session.telegramId);
    if (!caller?.isAdmin) return err('Forbidden', 403);
    const users = await dbScan<KittensUser>(USERS_TABLE);
    return ok(users);
  }

  // PATCH /auth/users/:telegramId — admin only: update status + musicianId
  if (method === 'PATCH' && path.startsWith('/auth/users/')) {
    const telegramId = path.slice('/auth/users/'.length);
    if (!telegramId) return err('Missing telegramId', 400);

    const authHeader = event.headers?.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return err('Unauthorized', 401);
    const session = await getSession(token);
    if (!session) return err('Session expired or invalid', 401);
    const caller = await getUser(session.telegramId);
    if (!caller?.isAdmin) return err('Forbidden', 403);

    const user = await getUser(telegramId);
    if (!user) return err('User not found', 404);

    let patch: { status?: string; musicianId?: string | null; role?: string | null };
    try {
      patch = JSON.parse(event.body ?? '{}');
    } catch {
      return err('Invalid JSON', 400);
    }

    const updated: KittensUser = {
      ...user,
      ...(patch.status ? { status: patch.status as KittensUser['status'] } : {}),
      ...(patch.status === 'approved' && user.status !== 'approved' ? { approvedAt: new Date().toISOString() } : {}),
      ...(patch.musicianId !== undefined
        ? patch.musicianId === null
          ? { musicianId: undefined }
          : { musicianId: patch.musicianId }
        : {}),
      ...(patch.role !== undefined
        ? patch.role === null
          ? { role: undefined }
          : { role: patch.role as KittensUser['role'] }
        : {}),
    };
    await dbPut(USERS_TABLE, updated as unknown as Record<string, unknown>);
    return ok(updated);
  }

  return err('Not found', 404);
}
