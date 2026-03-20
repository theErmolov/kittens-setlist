import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { musiciansHandler } from './handlers/musicians.js';
import { songsHandler } from './handlers/songs.js';
import { setlistsHandler } from './handlers/setlists.js';

export const handler = async (event: APIGatewayProxyEventV2) => {
  const path = event.rawPath;

  if (event.requestContext.http.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      },
      body: '',
    };
  }

  if (path.startsWith('/musicians')) return musiciansHandler(event);
  if (path.startsWith('/songs')) return songsHandler(event);
  if (path.startsWith('/setlists')) return setlistsHandler(event);

  return { statusCode: 404, body: 'Not found' };
};
