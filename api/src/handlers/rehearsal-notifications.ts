import { createHash, timingSafeEqual } from 'crypto';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { songListText, appendNotificationText, type NotificationText } from '../lib/notification-text.js';
import { dbScan } from '../lib/dynamo.js';
import { listUsers, getUserByTelegramId } from '../lib/people.js';
import { hydrate } from './rehearsals.js';
import type { Rehearsal, User } from '../lib/types.js';
import { HOUR, personalTrialAllowed, preparationGroups, preparationText, rehearsalLabel, rehearsalLabelText, rehearsalStart, reminderDue } from '../lib/rehearsal-reminder-plan.js';
import { claimDelivery, claimDeliveries, getState, notificationTable, preferenceId, releaseDelivery, setStateFields, type ReminderState } from '../lib/reminder-state.js';
import { sendBotMessage, telegramCall, telegramWebhookSecret, type InlineButton, type TelegramResult } from '../lib/telegram.js';
import { ok, err } from '../lib/response.js';

const groupChat = () => process.env.REHEARSAL_GROUP_CHAT_ID ?? '';
const schedulerInterval = () => process.env.REMINDER_CHECK_MINUTES === '1' ? HOUR / 60 : HOUR;
const rehearsalsTable = () => process.env.REHEARSALS_TABLE ?? 'kittens-rehearsals';
const url = (r: Rehearsal) => `https://kittens.band/rehearsals/${encodeURIComponent(r.id)}`;
const digestKey = (telegramId: string, r: Rehearsal) => `personal:${telegramId}:${r.id}:${rehearsalStart(r)}`;
const requestKey = (telegramId: string, r: Rehearsal) => `request:${telegramId}:${r.id}`;
const fingerprint = (r?: Rehearsal) => createHash('sha256').update(JSON.stringify(r ? [r.date, r.startTime, r.endTime, r.timeZone, r.location, r.cancelled] : ['deleted'])).digest('hex').slice(0, 24);
const groupButtons = (r: Rehearsal): InlineButton[][] => [[{ text: 'Открыть репетицию', url: url(r) }], [{ text: 'А мне чё учить?', callback_data: `prep:${r.id}` }]];
const personalButtons = (enabled: boolean, r: Rehearsal): InlineButton[][] => [[{ text: 'Открыть репетицию', url: url(r) }], [{ text: enabled ? 'Отключить напоминания' : 'Включить напоминания', callback_data: enabled ? 'notify:stop' : 'notify:resume' }]];

async function finishDelivery(id: string, receipt: string, result: TelegramResult<{ message_id: number }>, now: number): Promise<boolean> {
  if (result.ok) { await setStateFields(id, { status: 'sent', sentAt: now, messageId: result.result.message_id }); return true; }
  if (result.uncertain) {
    await setStateFields(id, { status: 'uncertain' });
    console.warn('Reminder delivery outcome unknown; not resending', { id });
  } else await releaseDelivery(id, receipt);
  return false;
}
async function deliverGroup(r: Rehearsal, kind: 'announcement' | 'reminder', now: number): Promise<boolean> {
  const chatId = groupChat();
  if (!chatId) return false;
  const id = kind === 'announcement' ? `announcement:${r.id}` : `group-reminder:${r.id}:${rehearsalStart(r)}`;
  const receipt = await claimDelivery(id, now);
  if (!receipt) return false;
  const message: NotificationText = { text: `${kind === 'announcement' ? 'Запланирована репетиция' : 'Напоминание о репетиции'}\n`, entities: [] };
  appendNotificationText(message, rehearsalLabelText(r));
  message.text += `${r.note ? `\n\n${r.note}` : ''}\n\n${r.songs.length ? 'Песни:\n' : 'План песен пока составляется.'}`;
  appendNotificationText(message, songListText(r.songs.map(item => item.song)));
  if (kind === 'announcement') await setStateFields(id, { rehearsalId: r.id, chatId, fingerprint: fingerprint(r), startAt: rehearsalStart(r), label: rehearsalLabel(r), expiresAt: Math.floor(rehearsalStart(r) / 1000) + 90 * 86400 });
  const result = await sendBotMessage(chatId, message.text, groupButtons(r), message.entities);
  const sent = await finishDelivery(id, receipt, result, now);
  return sent;
}
async function notifyChange(state: ReminderState, r: Rehearsal | undefined, now: number): Promise<void> {
  const nextFingerprint = fingerprint(r);
  if (!state.rehearsalId || !state.chatId || state.fingerprint === nextFingerprint) return;
  const id = `change:${state.rehearsalId}:${r?.version ?? state.fingerprint}:${nextFingerprint}`;
  const receipt = await claimDelivery(id, now);
  if (!receipt) return;
  const cancelled = !r || r.cancelled;
  const message: NotificationText = { text: cancelled ? 'Репетиция отменена.\n' : 'Изменились детали репетиции:\n', entities: [] };
  const storedLabel = state.label ?? '';
  appendNotificationText(message, r ? rehearsalLabelText(r) : { text: storedLabel, entities: storedLabel ? [{ type: 'bold', offset: 0, length: storedLabel.split(' · ')[0].length }] : [] });
  const result = await sendBotMessage(state.chatId, message.text, !cancelled && r ? groupButtons(r) : [], message.entities);
  if (await finishDelivery(id, receipt, result, now)) await setStateFields(state.id, { fingerprint: nextFingerprint, ...(r ? { startAt: rehearsalStart(r), label: rehearsalLabel(r), expiresAt: Math.floor(rehearsalStart(r) / 1000) + 90 * 86400 } : {}) });
}
async function removePreviousControl(telegramId: string, messageId?: number, rehearsalId?: string): Promise<boolean> {
  if (!messageId) return true;
  const result = await telegramCall('editMessageReplyMarkup', { chat_id: telegramId, message_id: messageId, reply_markup: { inline_keyboard: rehearsalId ? [[{ text: 'Открыть репетицию', url: `https://kittens.band/rehearsals/${encodeURIComponent(rehearsalId)}` }]] : [] } });
  return result.ok || result.unchanged === true || result.missing === true;
}
async function sendPersonal(user: User & { telegramId: string }, rehearsals: Rehearsal[], now: number, requested: boolean): Promise<'sent' | 'empty' | 'rejected' | 'uncertain'> {
  if (!user.musicianName) return 'empty';
  const live = await Promise.all(rehearsals.map(r => hydrate(r)));
  const digest = preparationText(live, user.musicianName, now);
  if (!digest.hasWork && !requested) return 'empty';
  const preference = await getState(preferenceId(user.telegramId));
  if (!requested && preference?.enabled === false) return 'empty';
  if (!await removePreviousControl(user.telegramId, preference?.latestMessageId, preference?.latestRehearsalId)) return 'rejected';
  // Clear the pointer before sending, so a removed button is immediately stale.
  await setStateFields(preferenceId(user.telegramId), { latestMessageId: 0 });
  const result = await sendBotMessage(user.telegramId, digest.text, personalButtons(preference?.enabled !== false, live[0]), digest.entities);
  if (!result.ok) {
    if (result.uncertain) console.warn('Personal message outcome unknown; not resending');
    return result.uncertain ? 'uncertain' : 'rejected';
  }
  await setStateFields(preferenceId(user.telegramId), { latestMessageId: result.result.message_id, latestRehearsalId: live[0].id });
  return 'sent';
}

export async function runRehearsalNotifications(now = Date.now()): Promise<void> {
  if (!groupChat()) return;
  const runStarted = Date.now();
  const rehearsals = await dbScan<Rehearsal>(rehearsalsTable());
  const byId = new Map(rehearsals.map(r => [r.id, r]));
  const previousAnnouncements = (await dbScan<ReminderState>(notificationTable())).filter(s => s.id.startsWith('announcement:') && s.status === 'sent');
  for (const state of previousAnnouncements) {
    if (Date.now() - runStarted > 40_000) return;
    const r = byId.get(state.rehearsalId!);
    // Ignore old completed rehearsals; cancellation/deletion of upcoming ones matters.
    if ((!r && (state.startAt ?? 0) > now) || (r && rehearsalStart(r) > now)) await notifyChange(state, r, now);
  }
  for (const r of rehearsals.filter(r => !r.cancelled && rehearsalStart(r) > now)) {
    if (Date.now() - runStarted > 40_000) return;
    if (now - Date.parse(r.createdAt) > HOUR) await deliverGroup(r, 'announcement', now);
    const until = rehearsalStart(r) - now;
    // The last configured scheduler slot before the 24h deadline. No late catch-up.
    if (until >= 24 * HOUR && until < 24 * HOUR + schedulerInterval() && now - Date.parse(r.createdAt) > HOUR) {
      const announcement = await getState(`announcement:${r.id}`);
      // A late-created announcement already carries these same logistics.
      if (announcement?.sentAt && now - announcement.sentAt >= schedulerInterval()) await deliverGroup(r, 'reminder', now);
    }
  }
  const users = (await listUsers()).filter(personalTrialAllowed);
  for (const group of preparationGroups(rehearsals, schedulerInterval())) {
    if (!reminderDue(group, now)) continue;
    for (const user of users) {
      if (Date.now() - runStarted > 40_000) return;
      if (!user.musicianName || (await getState(preferenceId(user.telegramId)))?.enabled === false) continue;
      const relevant = group.rehearsals.filter(r => r.attendees.includes(user.musicianName!) && rehearsalStart(r) > now && now - Date.parse(r.createdAt) > HOUR);
      const pending: Rehearsal[] = [];
      for (const r of relevant) if (!await getState(digestKey(user.telegramId, r))) pending.push(r);
      if (!pending.length) continue;
      const requests = await Promise.all(pending.map(r => getState(requestKey(user.telegramId, r))));
      // Compare against the projected reminder, not a delayed scheduler execution.
      if (requests.every(s => s?.lastRequestedAt !== undefined && group.due - s.lastRequestedAt <= 48 * HOUR)) continue;
      const live = await Promise.all(pending.map(r => hydrate(r)));
      if (!preparationText(live, user.musicianName, now).hasWork) continue;
      // Reserved concurrency 1 serializes webhook and scheduler; durable claims
      // also survive scheduler retries, crashes and changes to group membership.
      const receipt = await claimDeliveries(pending.map(r => digestKey(user.telegramId, r)), now);
      if (!receipt) continue;
      const sent = await sendPersonal(user, pending, now, false);
      for (const r of pending) {
        const id = digestKey(user.telegramId, r);
        if (sent === 'rejected' || sent === 'empty') await releaseDelivery(id, receipt);
        else await setStateFields(id, { status: sent === 'sent' ? 'sent' : 'uncertain', ...(sent === 'sent' ? { sentAt: now } : {}) });
      }
    }
  }
}

interface Callback {
  id: string; from: { id: number }; data?: string;
  message?: { message_id: number; chat: { id: number; type: string }; reply_markup?: { inline_keyboard: InlineButton[][] } };
}
async function answer(callback: Callback, text: string) {
  await telegramCall('answerCallbackQuery', { callback_query_id: callback.id, text, show_alert: true });
}
export async function handleReminderCallback(callback: Callback, now = Date.now()): Promise<void> {
  const telegramId = String(callback.from.id);
  const user = await getUserByTelegramId(telegramId);
  if (!personalTrialAllowed(user)) { await answer(callback, 'Личные уведомления пока тестируются только администраторами.'); return; }
  const data = callback.data ?? '';
  if (data === 'notify:stop' || data === 'notify:resume') {
    const state = await getState(preferenceId(telegramId));
    if (callback.message?.chat.type !== 'private' || String(callback.message.chat.id) !== telegramId || callback.message.message_id !== state?.latestMessageId) {
      await answer(callback, 'Используйте кнопку в последнем личном уведомлении.'); return;
    }
    const enabled = data === 'notify:resume';
    await setStateFields(preferenceId(telegramId), { enabled });
    const buttons = callback.message.reply_markup?.inline_keyboard ?? [];
    const keyboard = buttons.map(row => row.map(button => button.callback_data?.startsWith('notify:') ? { text: enabled ? 'Отключить напоминания' : 'Включить напоминания', callback_data: enabled ? 'notify:stop' : 'notify:resume' } : button));
    await telegramCall('editMessageReplyMarkup', { chat_id: telegramId, message_id: state!.latestMessageId, reply_markup: { inline_keyboard: keyboard } });
    await answer(callback, enabled ? 'Личные напоминания включены.' : 'Личные напоминания выключены. Запросить песни вручную всё ещё можно.');
    return;
  }
  if (!data.startsWith('prep:') || String(callback.message?.chat.id) !== groupChat()) { await answer(callback, 'Эта кнопка недоступна.'); return; }
  if (!user.musicianName) { await answer(callback, 'Сначала свяжите свой аккаунт с музыкантом в приложении.'); return; }
  const rehearsals = await dbScan<Rehearsal>(rehearsalsTable());
  const selected = rehearsals.find(r => r.id === data.slice(5));
  if (!selected || selected.cancelled || rehearsalStart(selected) <= now) { await answer(callback, 'Эта репетиция уже прошла или отменена.'); return; }
  const group = preparationGroups(rehearsals, schedulerInterval()).find(g => g.rehearsals.some(r => r.id === selected.id))!;
  const relevant = group.rehearsals.filter(r => rehearsalStart(r) > now && r.attendees.includes(user.musicianName!));
  if (!relevant.length) { await answer(callback, 'Вас нет в составе этой репетиции.'); return; }
  const prior = await getState(requestKey(telegramId, selected));
  if (prior?.lastRequestedAt && now - prior.lastRequestedAt < 30_000) { await answer(callback, 'Список уже отправлен — проверьте личные сообщения.'); return; }
  // Claim the callback itself to avoid a webhook retry posting twice.
  const id = `callback:${callback.id}`;
  if (!await claimDelivery(id, now)) { await answer(callback, 'Этот запрос уже обработан.'); return; }
  const result = await sendPersonal(user, relevant, now, true);
  if (result === 'sent') {
    for (const r of relevant) await setStateFields(requestKey(telegramId, r), { lastRequestedAt: now, expiresAt: Math.floor(rehearsalStart(r) / 1000) + 90 * 86400 });
    await answer(callback, 'Отправлено в личные сообщения.');
  } else await answer(callback, 'Не удалось отправить. Откройте @kittens_control_center_bot, нажмите Start и попробуйте снова. Настройки напоминаний доступны в приложении.');
}
export async function rehearsalNotificationsHandler(event: APIGatewayProxyEventV2 | Record<string, unknown>) {
  if (!('requestContext' in event)) { await runRehearsalNotifications(); return; }
  const request = event as APIGatewayProxyEventV2;
  if (request.requestContext.http.method !== 'POST') return err('Method not allowed', 405);
  const supplied = Object.entries(request.headers ?? {}).find(([key]) => key.toLowerCase() === 'x-telegram-bot-api-secret-token')?.[1] ?? '';
  const expected = telegramWebhookSecret();
  if (!process.env.TELEGRAM_BOT_TOKEN || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return err('Forbidden', 403);
  let update;
  try { update = JSON.parse(request.isBase64Encoded ? Buffer.from(request.body ?? '', 'base64').toString() : request.body ?? '{}'); } catch { return err('Invalid JSON', 400); }
  if (update?.callback_query?.id && Number.isSafeInteger(update.callback_query.from?.id)) await handleReminderCallback(update.callback_query);
  return ok({ ok: true });
}
