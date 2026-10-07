// Kittens Setlist API — Lambda entry point
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { musiciansHandler } from './handlers/musicians.js';
import { songsHandler } from './handlers/songs.js';
import { setlistsHandler } from './handlers/setlists.js';
import { rehearsalsHandler } from './handlers/rehearsals.js';
import { budgetHandler } from './handlers/budget.js';
import { authHandler, resolveAuth } from './handlers/auth.js';
import { presenceHandler } from './handlers/presence.js';
import { personalCommentsHandler } from './handlers/personal-comments.js';
import { err } from './lib/response.js';
import type { User } from './lib/types.js';

export const handler = async (event: APIGatewayProxyEventV2) => {
  // API Gateway HTTP API prepends the stage name to rawPath (e.g. /prod/songs).
  // Strip it so handlers can match on plain /songs, /setlists, /musicians.
  const stage = event.requestContext.stage ?? '';
  const rawPath = event.rawPath;
  const path = stage && stage !== '$default' && rawPath.startsWith(`/${stage}`)
    ? rawPath.slice(stage.length + 1) || '/'
    : rawPath;

  if (event.requestContext.http.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      },
      body: '',
    };
  }

  // Auth routes — public (no token required, handler enforces its own checks)
  if (path.startsWith('/auth')) return authHandler(event, path);

  // Stage view polling — GET /setlists/:id is public (no auth required)
  const isPublicSetlistGet =
    event.requestContext.http.method === 'GET' &&
    /^\/setlists\/[^/]+$/.test(path);

  // Presence heartbeats — public (works anonymous), user resolved opportunistically
  const isPresence = /^\/presence\/[^/]+$/.test(path);

  const isPersonalComment = /^\/(songs|setlists)\/[^/]+\/personal-comment$/.test(path);
  let user: User | null = null;
  if (isPresence || isPublicSetlistGet) {
    // Public route: resolve the user if a valid token is present, else anonymous
    user = await resolveAuth(event);
  } else {
    // All other routes require an authenticated, approved user
    user = await resolveAuth(event);
    if (!user) return err('Unauthorized', 401);
    if (user.status !== 'approved') return err('Your account is pending approval', 403);
    // Readers may also edit their own private notes; shared mutations require writer/admin.
    const method = event.requestContext.http.method;
    if (user.role !== 'writer' && !user.isAdmin && method !== 'GET' && !isPersonalComment) return err('Forbidden', 403);
  }

  if (isPersonalComment) return personalCommentsHandler(event, path, user!);

  if (path === '/rehearsals' || path.startsWith('/rehearsals/')) {
    return rehearsalsHandler(event, path, user!);
  }

  // Budget is admin-only — even for reads (financial data)
  if (path.startsWith('/budget')) {
    if (!user!.isAdmin) return err('Forbidden', 403);
    return budgetHandler(event, path, user!);
  }
  if (isPresence) return presenceHandler(event, path, user);
  if (path.startsWith('/musicians')) return musiciansHandler(event, path, user!);
  if (path.startsWith('/songs')) return songsHandler(event, path, user!);
  if (path.startsWith('/setlists')) return setlistsHandler(event, path, user!);

  return { statusCode: 404, body: 'Not found' };
};
