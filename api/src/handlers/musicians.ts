import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { dbGet, dbPut, dbDelete, dbScan } from '../lib/dynamo.js';
import { ok, err } from '../lib/response.js';
import type { BandMusician, KittensUser } from '../lib/types.js';
import { logAudit, diffSummary } from '../lib/audit.js';

const TABLE = process.env.MUSICIANS_TABLE ?? 'kittens-musicians';

export async function musiciansHandler(event: APIGatewayProxyEventV2, path: string, user: KittensUser) {
  const method = event.requestContext.http.method;
  const parts = path.split('/').filter(Boolean); // ['musicians'] or ['musicians', 'id']
  const id = parts[1] ?? null;

  if (!id || id === '') {
    if (method === 'GET') {
      const items = await dbScan<BandMusician>(TABLE);
      return ok(items);
    }
    if (method === 'POST') {
      const body = JSON.parse(event.body ?? '{}') as Omit<BandMusician, 'id'>;
      const musician: BandMusician = { ...body, id: crypto.randomUUID() };
      await dbPut(TABLE, musician as unknown as Record<string, unknown>);
      await logAudit({ action: 'musician.create', actor: user, entityType: 'musician', entityId: musician.id, entityName: musician.name, summary: `добавлен музыкант "${musician.name}"` });
      return ok(musician, 201);
    }
    return err('Method not allowed', 405);
  }

  if (method === 'PUT') {
    const body = JSON.parse(event.body ?? '{}') as BandMusician;
    const before = await dbGet<BandMusician>(TABLE, id);
    await dbPut(TABLE, { ...body, id } as unknown as Record<string, unknown>);
    const summary = before
      ? diffSummary(before as unknown as Record<string, unknown>, body as unknown as Record<string, unknown>, ['name', 'defaultInstruments', 'sortOrder', 'guest'])
      : 'обновлён';
    await logAudit({ action: 'musician.update', actor: user, entityType: 'musician', entityId: id, entityName: body.name, summary });
    return ok(body);
  }
  if (method === 'DELETE') {
    const before = await dbGet<BandMusician>(TABLE, id);
    await dbDelete(TABLE, id);
    await logAudit({ action: 'musician.delete', actor: user, entityType: 'musician', entityId: id, entityName: before?.name ?? id, summary: 'удалён' });
    return ok({ deleted: id });
  }
  if (method === 'GET') {
    const item = await dbGet<BandMusician>(TABLE, id);
    if (!item) return err('Not found', 404);
    return ok(item);
  }

  return err('Method not allowed', 405);
}
