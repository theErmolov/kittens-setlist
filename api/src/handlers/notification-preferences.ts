import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { User } from '../lib/types.js';
import { personalNotificationsAllowed } from '../lib/rehearsal-reminder-plan.js';
import { getState, preferenceId, setStateFields } from '../lib/reminder-state.js';
import { personalButtons } from '../lib/notification-buttons.js';
import { telegramCall } from '../lib/telegram.js';
import { ok, err } from '../lib/response.js';

export async function notificationPreferencesHandler(event: APIGatewayProxyEventV2, user: User) {
  if (!personalNotificationsAllowed(user)) return err('Approved Telegram account required', 403);
  const id = preferenceId(user.telegramId);
  if (event.requestContext.http.method === 'GET') return ok({ enabled: (await getState(id))?.enabled !== false });
  if (event.requestContext.http.method !== 'PATCH') return err('Method not allowed', 405);
  let body;
  try { body = JSON.parse(event.body ?? '{}'); } catch { return err('Invalid JSON', 400); }
  if (typeof body?.enabled !== 'boolean') return err('Invalid notification preference', 400);
  await setStateFields(id, { enabled: body.enabled });
  const state = await getState(id);
  if (state?.latestMessageId && state.latestRehearsalId) {
    const result = await telegramCall('editMessageReplyMarkup', {
      chat_id: user.telegramId,
      message_id: state.latestMessageId,
      reply_markup: { inline_keyboard: personalButtons(body.enabled, state.latestRehearsalId, user) },
    });
    // The saved preference remains authoritative if the old message was deleted
    // or Telegram is temporarily unavailable.
    if (!result.ok && !result.unchanged && !result.missing) console.warn('Could not synchronize personal reminder button');
  }
  return ok({ enabled: body.enabled });
}
