import { randomUUID } from 'crypto';
import { db } from './dynamo.js';
import { QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { KittensUser } from './types.js';

const TABLE = process.env.AUDIT_LOG_TABLE ?? 'kittens-audit-log';

export type AuditAction =
  | 'song.create' | 'song.update' | 'song.delete' | 'song.progress_update'
  | 'musician.create' | 'musician.update' | 'musician.delete'
  | 'setlist.create' | 'setlist.update' | 'setlist.delete'
  | 'setlist.song_add' | 'setlist.song_remove' | 'setlist.played_toggle'
  | 'setlist.break_add' | 'setlist.break_remove' | 'setlist.break_update'
  | 'setlist.entry_song_edit' | 'setlist.entry_progress_update' | 'setlist.entry_comment_update'
  | 'setlist.reorder'
  | 'user.approve' | 'user.reject' | 'user.role_change' | 'user.musician_assign'
  | 'budget.create' | 'budget.update' | 'budget.delete';

// Flip any action to false to silence it without changing handler code
export const AUDIT_ACTIONS: Record<AuditAction, boolean> = {
  'song.create': true,
  'song.update': true,
  'song.delete': true,
  'song.progress_update': true,
  'musician.create': true,
  'musician.update': true,
  'musician.delete': true,
  'setlist.create': true,
  'setlist.update': true,
  'setlist.delete': true,
  'setlist.song_add': true,
  'setlist.song_remove': true,
  'setlist.played_toggle': true,
  'setlist.break_add': true,
  'setlist.break_remove': true,
  'setlist.break_update': true,
  'setlist.entry_song_edit': true,
  'setlist.entry_progress_update': true,
  'setlist.entry_comment_update': true,
  'setlist.reorder': false,
  'user.approve': true,
  'user.reject': true,
  'user.role_change': true,
  'user.musician_assign': true,
  'budget.create': true,
  'budget.update': true,
  'budget.delete': true,
};

export type EntityType = 'song' | 'setlist' | 'musician' | 'setlist_entry' | 'user' | 'budget';

export interface AuditLogEntry {
  pk: string;
  sk: string;
  timestamp: string;
  action: AuditAction;
  actorTelegramId: string;
  actorName: string;
  entityType: EntityType;
  entityId: string;
  entityName: string;
  summary: string;
  details?: Record<string, { before?: unknown; after?: unknown }>;
}

export interface LogAuditParams {
  action: AuditAction;
  actor: KittensUser;
  entityType: EntityType;
  entityId: string;
  entityName: string;
  summary: string;
  details?: Record<string, { before?: unknown; after?: unknown }>;
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  if (!AUDIT_ACTIONS[params.action]) return;
  try {
    const timestamp = new Date().toISOString();
    const sk = `${timestamp}#${randomUUID()}`;
    const actorName = [params.actor.firstName, params.actor.lastName].filter(Boolean).join(' ');
    const item: AuditLogEntry = {
      pk: 'audit',
      sk,
      timestamp,
      action: params.action,
      actorTelegramId: params.actor.telegramId,
      actorName,
      entityType: params.entityType,
      entityId: params.entityId,
      entityName: params.entityName,
      summary: params.summary,
      ...(params.details ? { details: params.details } : {}),
    };
    await db.send(new PutCommand({ TableName: TABLE, Item: item as unknown as Record<string, unknown> }));
  } catch (e) {
    console.error('[audit] Failed to write audit log entry:', e);
  }
}

export async function queryAuditLog(
  limit: number,
  cursor?: string,
): Promise<{ items: AuditLogEntry[]; nextCursor?: string }> {
  const exclusiveStartKey = cursor
    ? (JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as Record<string, unknown>)
    : undefined;

  const res = await db.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': 'audit' },
    ScanIndexForward: false,
    Limit: limit,
    ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
  }));

  const items = (res.Items ?? []) as AuditLogEntry[];
  const nextCursor = res.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString('base64')
    : undefined;

  return { items, nextCursor };
}

// ─── Summary helpers ──────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  queue:     '⚪',
  structure: '🟡',
  mastering: '🟠',
  ready:     '🟢',
};

export function stageLabel(stage: string | null): string {
  if (!stage) return '—';
  return STAGE_LABELS[stage] ?? stage;
}

export function musiciansDiff(
  before: Record<string, { instruments?: string[] }>,
  after: Record<string, { instruments?: string[] }>,
): string {
  const parts: string[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const name of allKeys) {
    const b = before[name];
    const a = after[name];
    if (!b) {
      const instr = a?.instruments?.length ? ` (${a.instruments.join(', ')})` : '';
      parts.push(`+ ${name}${instr}`);
    } else if (!a) {
      parts.push(`- ${name}`);
    } else if (JSON.stringify(b.instruments ?? []) !== JSON.stringify(a.instruments ?? [])) {
      const bi = (b.instruments ?? []).join(', ') || '—';
      const ai = (a.instruments ?? []).join(', ') || '—';
      parts.push(`${name}: ${bi} → ${ai}`);
    }
  }
  return parts.join(', ');
}

export function diffSummary(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): string {
  const parts: string[] = [];
  for (const field of fields) {
    const b = JSON.stringify(before[field] ?? null);
    const a = JSON.stringify(after[field] ?? null);
    if (b !== a) parts.push(`${field}: ${b} → ${a}`);
  }
  return parts.join(', ') || 'no changes';
}
