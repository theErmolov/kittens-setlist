import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { assertTargetParity, buildPeople, CONTROL_ID } from './people-migration-lib.mjs';

const command = process.argv[2];
if (!['validate', 'migrate', 'parity'].includes(command)) {
  throw new Error('Usage: node scripts/migrate-people.mjs <validate|migrate|parity>');
}

const usersTable = process.env.USERS_TABLE ?? 'kittens-users';
const musiciansTable = process.env.MUSICIANS_TABLE ?? 'kittens-musicians';
const peopleTable = process.env.PEOPLE_TABLE ?? 'kittens-people';
const expectedCount = process.env.EXPECTED_PEOPLE_COUNT
  ? Number.parseInt(process.env.EXPECTED_PEOPLE_COUNT, 10)
  : undefined;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

async function scan(table) {
  const items = [];
  let lastKey;
  do {
    const result = await db.send(new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey }));
    items.push(...(result.Items ?? []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function sourceSnapshot() {
  const [users, musicians] = await Promise.all([scan(usersTable), scan(musiciansTable)]);
  return { users, musicians, people: buildPeople(users, musicians, expectedCount) };
}

async function putControl(activeStore, mutationsLocked) {
  await db.send(new PutCommand({
    TableName: peopleTable,
    Item: { id: CONTROL_ID, activeStore, mutationsLocked, updatedAt: new Date().toISOString() },
  }));
}

async function currentControl() {
  const result = await db.send(new GetCommand({ TableName: peopleTable, Key: { id: CONTROL_ID } }));
  return result.Item;
}

if (command === 'validate') {
  const { users, musicians, people } = await sourceSnapshot();
  console.log(`Validated ${users.length} legacy users + ${musicians.length} musicians -> ${people.length} people; no writes performed.`);
} else if (command === 'parity') {
  const { people } = await sourceSnapshot();
  assertTargetParity(people, await scan(peopleTable));
  console.log(`Parity verified for ${people.length} people.`);
} else {
  const initial = await sourceSnapshot();
  const control = await currentControl();
  if (control?.activeStore === 'people') {
    assertTargetParity(initial.people, await scan(peopleTable));
    console.log(`People store is already active; parity verified for ${initial.people.length} people.`);
  } else {
    await putControl('legacy', true);
    try {
      const locked = await sourceSnapshot();
      const expectedIds = new Set(locked.people.map(person => person.id));
      const existing = (await scan(peopleTable)).filter(item => item.id !== CONTROL_ID);
      for (const item of existing) {
        if (!expectedIds.has(item.id)) {
          await db.send(new DeleteCommand({ TableName: peopleTable, Key: { id: item.id } }));
        }
      }
      for (const person of locked.people) {
        await db.send(new PutCommand({ TableName: peopleTable, Item: person }));
      }
      assertTargetParity(locked.people, await scan(peopleTable));
      await putControl('people', false);
      console.log(`Migrated, verified, and activated ${locked.people.length} people.`);
    } catch (error) {
      await putControl('legacy', false);
      throw error;
    }
  }
}
