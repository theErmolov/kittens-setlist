import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { dbGet, dbPut, dbDelete, dbScan } from '../lib/dynamo.js';
import { ok, err } from '../lib/response.js';
import type { BandMusician } from '../lib/types.js';

const TABLE = process.env.MUSICIANS_TABLE ?? 'kittens-musicians';

export async function musiciansHandler(event: APIGatewayProxyEventV2, path: string) {
  const method = event.requestContext.http.method;
  // path is already stage-stripped: /musicians or /musicians/:id
  const parts = path.split('/').filter(Boolean); // ['musicians'] or ['musicians', 'id']
  const id = parts[1] ?? null;

  if (!id || id === '') {
    // Collection
    if (method === 'GET') {
      const items = await dbScan<BandMusician>(TABLE);
      return ok(items);
    }
    if (method === 'POST') {
      const body = JSON.parse(event.body ?? '{}') as Omit<BandMusician, 'id'>;
      const musician: BandMusician = { ...body, id: crypto.randomUUID() };
      await dbPut(TABLE, musician as unknown as Record<string, unknown>);
      return ok(musician, 201);
    }
    return err('Method not allowed', 405);
  }

  // Single item
  if (method === 'PUT') {
    const body = JSON.parse(event.body ?? '{}') as BandMusician;
    await dbPut(TABLE, { ...body, id } as unknown as Record<string, unknown>);
    return ok(body);
  }
  if (method === 'DELETE') {
    await dbDelete(TABLE, id);
    return ok({ deleted: id });
  }
  if (method === 'GET') {
    const item = await dbGet<BandMusician>(TABLE, id);
    if (!item) return err('Not found', 404);
    return ok(item);
  }

  return err('Method not allowed', 405);
}
