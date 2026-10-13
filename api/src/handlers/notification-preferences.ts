import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { User } from '../lib/types.js';
import { personalTrialAllowed } from '../lib/rehearsal-reminder-plan.js';
import { getState, preferenceId, setStateFields } from '../lib/reminder-state.js';
import { ok, err } from '../lib/response.js';

export async function notificationPreferencesHandler(event: APIGatewayProxyEventV2, user: User) {
  if (!personalTrialAllowed(user)) return err('Personal reminders are currently admin-only', 403);
  const id = preferenceId(user.telegramId);
  if (event.requestContext.http.method === 'GET') return ok({ enabled: (await getState(id))?.enabled !== false });
  if (event.requestContext.http.method !== 'PATCH') return err('Method not allowed', 405);
  let body;
  try { body = JSON.parse(event.body ?? '{}'); } catch { return err('Invalid JSON', 400); }
  if (typeof body?.enabled !== 'boolean') return err('Invalid notification preference', 400);
  await setStateFields(id, { enabled: body.enabled });
  return ok({ enabled: body.enabled });
}
