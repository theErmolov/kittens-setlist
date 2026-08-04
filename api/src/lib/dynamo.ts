import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
export const db = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });

export async function dbGet<T>(table: string, id: string): Promise<T | undefined> {
  const res = await db.send(new GetCommand({ TableName: table, Key: { id } }));
  return res.Item as T | undefined;
}

export async function dbPut(table: string, item: Record<string, unknown>): Promise<void> {
  await db.send(new PutCommand({ TableName: table, Item: item }));
}

export async function dbDelete(table: string, id: string): Promise<void> {
  await db.send(new DeleteCommand({ TableName: table, Key: { id } }));
}

export async function dbGetByKey<T>(table: string, key: Record<string, unknown>): Promise<T | undefined> {
  const res = await db.send(new GetCommand({ TableName: table, Key: key }));
  return res.Item as T | undefined;
}

export async function dbDeleteByKey(table: string, key: Record<string, unknown>): Promise<void> {
  await db.send(new DeleteCommand({ TableName: table, Key: key }));
}

export async function dbScan<T>(table: string): Promise<T[]> {
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await db.send(new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey }));
    items.push(...((res.Items ?? []) as T[]));
    lastKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return items;
}

export async function dbQueryIndex<T>(
  table: string,
  indexName: string,
  keyName: string,
  keyValue: string,
): Promise<T[]> {
  const res = await db.send(new QueryCommand({
    TableName: table,
    IndexName: indexName,
    KeyConditionExpression: '#key = :value',
    ExpressionAttributeNames: { '#key': keyName },
    ExpressionAttributeValues: { ':value': keyValue },
  }));
  return (res.Items ?? []) as T[];
}

export async function dbTransactPutAndDelete(
  table: string,
  item: Record<string, unknown>,
  deleteId?: string,
): Promise<void> {
  await db.send(new TransactWriteCommand({
    TransactItems: [
      { Put: { TableName: table, Item: item } },
      ...(deleteId ? [{ Delete: { TableName: table, Key: { id: deleteId } } }] : []),
    ],
  }));
}
