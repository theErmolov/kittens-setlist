import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { dbScan } from '../lib/dynamo.js';
import { ok, err } from '../lib/response.js';
import type { PresenceEntry, User } from '../lib/types.js';

const TABLE = process.env.PRESENCE_TABLE ?? 'kittens-presence-v2';

/** Read-only admin view of existing collaborative presence; no new tracking. */
export async function onlinePresenceHandler(event: APIGatewayProxyEventV2, user: User | null) {
  if (!user) return err('Unauthorized', 401);
  if (user.status !== 'approved' || !user.isAdmin) return err('Forbidden', 403);
  if (event.requestContext.http.method !== 'GET') return err('Method not allowed', 405);
  const now = Math.floor(Date.now() / 1000);
  const entries = await dbScan<PresenceEntry>(TABLE);
  return ok(entries.filter(entry =>
    typeof entry.expiresAt === 'number' && entry.expiresAt > now &&
    (entry.room === 'backlog' || /^setlist:.+$/.test(entry.room))
  ));
}
