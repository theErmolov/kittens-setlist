import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { dbPut, dbDeleteByKey, dbQueryPartition } from '../lib/dynamo.js';
import { ok, err } from '../lib/response.js';
import type { PresenceEntry, User } from '../lib/types.js';

const TABLE = process.env.PRESENCE_TABLE ?? 'kittens-presence';
const TTL_SECONDS = 90;

function displayName(user: User): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.musicianName || 'гость';
}

/**
 * Presence heartbeats for setlist views. Public route (works anonymous, like
 * GET /setlists/:id): if a Bearer token is present the user is resolved and
 * their name/canMark derived server-side; otherwise the viewer is anonymous.
 *
 *   POST   /setlists/:id/presence   { clientId }   → upsert self, return { others }
 *   DELETE /setlists/:id/presence?clientId=…       → remove self (leave)
 */
export async function presenceHandler(
  event: APIGatewayProxyEventV2,
  strippedPath: string,
  user: User | null,
) {
  const method = event.requestContext.http.method;
  const parts = strippedPath.split('/').filter(Boolean); // ['setlists', id, 'presence']
  const setlistId = parts[1] ?? null;
  if (!setlistId) return err('Missing setlist id', 400);

  if (method === 'POST') {
    let clientId: string | undefined;
    try {
      clientId = (JSON.parse(event.body ?? '{}') as { clientId?: string }).clientId;
    } catch {
      return err('Invalid JSON', 400);
    }
    if (!clientId) return err('clientId is required', 400);

    const now = Math.floor(Date.now() / 1000);
    const item: PresenceEntry = {
      setlistId,
      clientId,
      ...(user?.id ? { userId: user.id } : {}),
      name: user ? displayName(user) : 'гость',
      canMark: Boolean(user?.isAdmin || user?.role === 'writer'),
      lastSeen: new Date().toISOString(),
      expiresAt: now + TTL_SECONDS,
    } as PresenceEntry & { setlistId: string };

    await dbPut(TABLE, item as unknown as Record<string, unknown>);

    // TTL deletion is eventual, so filter expired entries in JS. Return everyone
    // except the caller — the client decides whether to poll based on `canMark`.
    const all = await dbQueryPartition<PresenceEntry & { setlistId: string }>(TABLE, 'setlistId', setlistId);
    const others = all
      .filter(i => i.clientId !== clientId && typeof i.expiresAt === 'number' && i.expiresAt > now)
      .map(({ setlistId: _setlistId, ...rest }) => rest);
    return ok({ others });
  }

  if (method === 'DELETE') {
    const clientId = event.queryStringParameters?.clientId;
    if (!clientId) return err('clientId is required', 400);
    await dbDeleteByKey(TABLE, { setlistId, clientId });
    return ok({});
  }

  return err('Method not allowed', 405);
}
