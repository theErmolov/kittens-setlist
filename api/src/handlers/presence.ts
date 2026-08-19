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
 * Presence heartbeats for collaborative views (setlist editor, stage, backlog).
 * Public route (works anonymous): if a Bearer token is present the user is
 * resolved and their name/canMark derived server-side; otherwise anonymous.
 *
 *   POST   /presence/:room        { clientId }   → upsert self, return { others }
 *   DELETE /presence/:room?clientId=…            → remove self (leave)
 *
 * `room` is the shared resource being viewed: `backlog` or `setlist:<id>`.
 */
export async function presenceHandler(
  event: APIGatewayProxyEventV2,
  strippedPath: string,
  user: User | null,
) {
  const method = event.requestContext.http.method;
  const parts = strippedPath.split('/').filter(Boolean); // ['presence', room]
  const room = decodeURIComponent(parts[1] ?? '');
  if (!room) return err('Missing room', 400);

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
      room,
      clientId,
      ...(user?.id ? { userId: user.id } : {}),
      name: user ? displayName(user) : 'гость',
      canMark: Boolean(user?.isAdmin || user?.role === 'writer'),
      lastSeen: new Date().toISOString(),
      expiresAt: now + TTL_SECONDS,
    };

    await dbPut(TABLE, item as unknown as Record<string, unknown>);

    // TTL deletion is eventual, so filter expired entries in JS. Return everyone
    // except the caller — the client decides whether to poll based on `canMark`.
    const all = await dbQueryPartition<PresenceEntry>(TABLE, 'room', room);
    const others = all
      .filter(i => i.clientId !== clientId && typeof i.expiresAt === 'number' && i.expiresAt > now);
    return ok({ others });
  }

  if (method === 'DELETE') {
    const clientId = event.queryStringParameters?.clientId;
    if (!clientId) return err('clientId is required', 400);
    await dbDeleteByKey(TABLE, { room, clientId });
    return ok({});
  }

  return err('Method not allowed', 405);
}
