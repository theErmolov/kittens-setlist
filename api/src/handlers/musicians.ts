import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { ok, err } from '../lib/response.js';
import type { BandMusician, User } from '../lib/types.js';
import {
  deleteMusicianOnlyUser,
  getUserById,
  listMusicians,
  mutationsAreLocked,
  sanitizeInstruments,
  saveUser,
} from '../lib/people.js';
import { logAudit, diffSummary } from '../lib/audit.js';
import { removeMusicianFields } from '../lib/people-domain.js';

function parseMusician(body: string | null | undefined): Omit<BandMusician, 'id'> {
  const value = JSON.parse(body ?? '{}') as Partial<BandMusician>;
  if (!value.name?.trim()) throw new Error('Musician name is required');
  const defaultInstruments = sanitizeInstruments(value.defaultInstruments);
  if (value.sortOrder !== undefined && !Number.isFinite(value.sortOrder)) throw new Error('Invalid sortOrder');
  return {
    name: value.name.trim(),
    ...(defaultInstruments !== undefined ? { defaultInstruments } : {}),
    ...(value.sortOrder !== undefined ? { sortOrder: value.sortOrder } : {}),
    ...(value.guest !== undefined ? { guest: Boolean(value.guest) } : {}),
  };
}

function applyMusician(user: User, musician: Omit<BandMusician, 'id'>): User {
  return {
    ...user,
    musicianName: musician.name,
    defaultInstruments: musician.defaultInstruments,
    sortOrder: musician.sortOrder,
    guest: musician.guest,
  };
}

function projection(user: User): BandMusician {
  return {
    id: user.id,
    name: user.musicianName!,
    ...(user.defaultInstruments ? { defaultInstruments: user.defaultInstruments } : {}),
    ...(user.sortOrder !== undefined ? { sortOrder: user.sortOrder } : {}),
    ...(user.guest !== undefined ? { guest: user.guest } : {}),
  };
}

export async function musiciansHandler(event: APIGatewayProxyEventV2, path: string, actor: User) {
  const method = event.requestContext.http.method;
  const parts = path.split('/').filter(Boolean);
  const id = parts[1] ? decodeURIComponent(parts[1]) : null;

  if (method === 'GET') {
    const items = await listMusicians();
    if (!id) return ok(items);
    const item = items.find(musician => musician.id === id);
    return item ? ok(item) : err('Not found', 404);
  }

  if (!actor.isAdmin) return err('Forbidden', 403);
  if (await mutationsAreLocked()) return err('People migration in progress', 423);

  if (!id && method === 'POST') {
    let body: Omit<BandMusician, 'id'>;
    try {
      body = parseMusician(event.body);
    } catch (error) {
      return err((error as Error).message || 'Invalid JSON', 400);
    }
    const user: User = applyMusician({ id: randomUUID() }, body);
    await saveUser(user);
    const musician = projection(user);
    await logAudit({
      action: 'musician.create', actor, entityType: 'musician', entityId: user.id,
      entityName: musician.name, summary: `добавлен музыкант "${musician.name}"`,
    });
    return ok(musician, 201);
  }

  if (!id) return err('Method not allowed', 405);
  const before = await getUserById(id);
  if (!before?.musicianName) return err('Not found', 404);

  if (method === 'PUT') {
    let body: Omit<BandMusician, 'id'>;
    try {
      body = parseMusician(event.body);
    } catch (error) {
      return err((error as Error).message || 'Invalid JSON', 400);
    }
    const updated = applyMusician(before, body);
    await saveUser(updated, before);
    const musician = projection(updated);
    const summary = diffSummary(
      projection(before) as unknown as Record<string, unknown>,
      musician as unknown as Record<string, unknown>,
      ['name', 'defaultInstruments', 'sortOrder', 'guest'],
    );
    await logAudit({
      action: 'musician.update', actor, entityType: 'musician', entityId: id,
      entityName: musician.name, summary,
    });
    return ok(musician);
  }

  if (method === 'DELETE') {
    if (before.telegramId) {
      const updated = removeMusicianFields(before);
      await saveUser(updated, before);
      await logAudit({
        action: 'user.musician_remove', actor, entityType: 'user', entityId: id,
        entityName: [before.firstName, before.lastName].filter(Boolean).join(' ') || before.musicianName,
        summary: `удалён статус музыканта "${before.musicianName}"; доступ Telegram сохранён`,
      });
    } else {
      await deleteMusicianOnlyUser(before);
      await logAudit({
        action: 'musician.delete', actor, entityType: 'musician', entityId: id,
        entityName: before.musicianName, summary: 'удалён пользователь-музыкант без доступа Telegram',
      });
    }
    return ok({ deleted: id });
  }

  return err('Method not allowed', 405);
}
