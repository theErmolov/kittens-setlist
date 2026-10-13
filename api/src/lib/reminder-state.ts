import { randomUUID } from 'crypto';
import { GetCommand, PutCommand, DeleteCommand, UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { db } from './dynamo.js';

export const notificationTable = () => process.env.NOTIFICATIONS_TABLE ?? 'kittens-notifications';
export interface ReminderState {
  id: string;
  enabled?: boolean;
  latestMessageId?: number;
  latestRehearsalId?: string;
  lastRequestedAt?: number;
  sentAt?: number;
  status?: 'attempting' | 'sent' | 'uncertain';
  messageId?: number;
  chatId?: string;
  fingerprint?: string;
  startAt?: number;
  label?: string;
  rehearsalId?: string;
  receipt?: string;
  expiresAt?: number;
}
/** Changing the version resets delivery/request history while retaining opt-outs
 * and the latest personal control pointer. Old attempts expire normally via TTL. */
export function deliveryStateId(id: string): string {
  const version = process.env.NOTIFICATION_DELIVERY_VERSION;
  if (!version || id.startsWith('preference:') || id.startsWith(`v:${version}:`)) return id;
  return `v:${version}:${id}`;
}
export const preferenceId = (telegramId: string) => `preference:${telegramId}`;
export async function getState(id: string): Promise<ReminderState | undefined> {
  return (await db.send(new GetCommand({ TableName: notificationTable(), Key: { id: deliveryStateId(id) }, ConsistentRead: true }))).Item as ReminderState | undefined;
}
export async function setStateFields(id: string, fields: Partial<ReminderState>): Promise<void> {
  const entries = Object.entries(fields).filter(([key, value]) => key !== 'id' && value !== undefined);
  if (!entries.length) return;
  await db.send(new UpdateCommand({ TableName: notificationTable(), Key: { id: deliveryStateId(id) },
    UpdateExpression: `SET ${entries.map((_, i) => `#f${i} = :v${i}`).join(', ')}`,
    ExpressionAttributeNames: Object.fromEntries(entries.map(([key], i) => [`#f${i}`, key])),
    ExpressionAttributeValues: Object.fromEntries(entries.map(([, value], i) => [`:v${i}`, value])),
  }));
}
/** Durable attempt before contacting Telegram; ambiguous sends stay claimed. */
export async function claimDelivery(id: string, now: number): Promise<string | undefined> {
  const receipt = randomUUID();
  try {
    await db.send(new PutCommand({ TableName: notificationTable(), Item: { id: deliveryStateId(id), receipt, status: 'attempting', expiresAt: Math.floor(now / 1000) + 90 * 86400 }, ConditionExpression: 'attribute_not_exists(id)' }));
    return receipt;
  } catch (error) {
    if ((error as Error).name === 'ConditionalCheckFailedException') return undefined;
    throw error;
  }
}
export async function releaseDelivery(id: string, receipt: string): Promise<void> {
  await db.send(new DeleteCommand({ TableName: notificationTable(), Key: { id: deliveryStateId(id) }, ConditionExpression: '#receipt = :receipt', ExpressionAttributeNames: { '#receipt': 'receipt' }, ExpressionAttributeValues: { ':receipt': receipt } }));
}

export async function claimDeliveries(ids: string[], now: number): Promise<string | undefined> {
  const receipt = randomUUID();
  try {
    await db.send(new TransactWriteCommand({ TransactItems: ids.map(id => ({ Put: {
      TableName: notificationTable(), Item: { id: deliveryStateId(id), receipt, status: 'attempting', expiresAt: Math.floor(now / 1000) + 90 * 86400 }, ConditionExpression: 'attribute_not_exists(id)',
    } })) }));
    return receipt;
  } catch (error) {
    const value = error as { name?: string; CancellationReasons?: { Code?: string }[] };
    if (value.name === 'TransactionCanceledException' && value.CancellationReasons?.some(r => r.Code === 'ConditionalCheckFailed')) return undefined;
    throw error;
  }
}
