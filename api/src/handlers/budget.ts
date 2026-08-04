import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { dbGet, dbPut, dbDelete, dbScan } from '../lib/dynamo.js';
import { ok, err } from '../lib/response.js';
import type { BudgetEntry, User } from '../lib/types.js';
import { logAudit, diffSummary } from '../lib/audit.js';
import { getReceiptUploadUrl, getReceiptDownloadUrl } from '../lib/s3.js';

const TABLE = process.env.BUDGET_TABLE ?? 'kittens-budget';

const KIND_LABEL: Record<string, string> = { income: 'доход', expense: 'расход', debt: 'долг' };

/** Human-readable name for an entry, used in the audit log. */
function entryName(e: BudgetEntry): string {
  const who = e.kind === 'income' ? e.person
    : e.kind === 'expense' ? (e.description ?? e.spentBy)
    : e.creditor;
  const amount = (e.amount / 100).toFixed(2);
  return `${KIND_LABEL[e.kind] ?? e.kind} ${amount}€${who ? ` (${who})` : ''}`;
}

export async function budgetHandler(event: APIGatewayProxyEventV2, path: string, user: User) {
  const method = event.requestContext.http.method;
  const parts = path.split('/').filter(Boolean); // ['budget'] | ['budget', id] | ['budget', id, 'receipt-url']
  const id = parts[1] ?? null;
  const sub = parts[2] ?? null;

  // ─── Receipt presigned URLs: /budget/:id/receipt-url ──────────────────────
  if (id && sub === 'receipt-url') {
    if (method === 'POST') {
      const { contentType } = JSON.parse(event.body ?? '{}') as { contentType?: string };
      const key = `receipts/${id}/${randomUUID()}`;
      const url = await getReceiptUploadUrl(key, contentType ?? 'application/octet-stream');
      return ok({ url, key });
    }
    if (method === 'GET') {
      const entry = await dbGet<BudgetEntry>(TABLE, id);
      if (!entry || entry.kind !== 'expense' || !entry.receiptKey) return err('Not found', 404);
      const url = await getReceiptDownloadUrl(entry.receiptKey);
      return ok({ url });
    }
    return err('Method not allowed', 405);
  }

  // ─── Collection: /budget ──────────────────────────────────────────────────
  if (!id) {
    if (method === 'GET') {
      const items = await dbScan<BudgetEntry>(TABLE);
      return ok(items);
    }
    if (method === 'POST') {
      const body = JSON.parse(event.body ?? '{}') as Omit<BudgetEntry, 'id' | 'createdAt' | 'createdBy'>;
      const entry = {
        ...body,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        createdBy: user.telegramId ?? user.id,
      } as BudgetEntry;
      await dbPut(TABLE, entry as unknown as Record<string, unknown>);
      await logAudit({ action: 'budget.create', actor: user, entityType: 'budget', entityId: entry.id, entityName: entryName(entry), summary: `добавлен ${entryName(entry)}` });
      return ok(entry, 201);
    }
    return err('Method not allowed', 405);
  }

  // ─── Item: /budget/:id ────────────────────────────────────────────────────
  if (method === 'PUT') {
    const body = JSON.parse(event.body ?? '{}') as BudgetEntry;
    const before = await dbGet<BudgetEntry>(TABLE, id);
    if (!before) return err('Not found', 404);
    // Preserve server-set provenance; client cannot change it.
    const entry = { ...body, id, createdAt: before.createdAt, createdBy: before.createdBy } as BudgetEntry;
    await dbPut(TABLE, entry as unknown as Record<string, unknown>);
    const summary = diffSummary(
      before as unknown as Record<string, unknown>,
      entry as unknown as Record<string, unknown>,
      ['amount', 'method', 'person', 'spentBy', 'description', 'creditor', 'paid', 'date', 'comment', 'setlistId', 'receiptKey'],
    );
    await logAudit({ action: 'budget.update', actor: user, entityType: 'budget', entityId: id, entityName: entryName(entry), summary });
    return ok(entry);
  }

  if (method === 'DELETE') {
    const before = await dbGet<BudgetEntry>(TABLE, id);
    await dbDelete(TABLE, id);
    await logAudit({ action: 'budget.delete', actor: user, entityType: 'budget', entityId: id, entityName: before ? entryName(before) : id, summary: 'удалён' });
    return ok({ deleted: id });
  }

  if (method === 'GET') {
    const item = await dbGet<BudgetEntry>(TABLE, id);
    if (!item) return err('Not found', 404);
    return ok(item);
  }

  return err('Method not allowed', 405);
}
