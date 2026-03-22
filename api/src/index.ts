// Kittens Setlist API — Lambda entry point
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { musiciansHandler } from './handlers/musicians.js';
import { songsHandler } from './handlers/songs.js';
import { setlistsHandler } from './handlers/setlists.js';

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

  if (path.startsWith('/musicians')) return musiciansHandler(event, path);
  if (path.startsWith('/songs')) return songsHandler(event, path);
  if (path.startsWith('/setlists')) return setlistsHandler(event, path);

  return { statusCode: 404, body: 'Not found' };
};
