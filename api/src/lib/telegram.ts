import { createHmac, createHash } from 'crypto';
import type { BoldEntity } from './notification-text.js';
import type { User } from './types.js';

export interface BotNotification {
  text: string;
  button?: { text: string; url: string };
}

/** Direct delivery to an authenticated user; failures never interrupt the caller. */
export async function sendUserNotification(user: User, notification: BotNotification): Promise<boolean> {
  if (!user.telegramId || user.status !== 'approved') return false;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('Telegram notification skipped: bot token is not configured');
    return false;
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(2000),
      body: JSON.stringify({
        chat_id: user.telegramId,
        text: notification.text,
        link_preview_options: { is_disabled: true },
        ...(notification.button ? {
          reply_markup: { inline_keyboard: [[notification.button]] },
        } : {}),
      }),
    });
    const result = await response.json() as { ok?: boolean };
    if (!response.ok || result.ok !== true) {
      console.warn('Telegram notification failed', { status: response.status });
      return false;
    }
    return true;
  } catch {
    // Fetch errors may contain the bot token in their URL. Never log them.
    console.warn('Telegram notification failed: network error or timeout');
    return false;
  }
}

export interface TelegramAuthData {
  id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
}

/**
 * Verifies the Telegram Login Widget auth data.
 * https://core.telegram.org/widgets/login#checking-authorization
 *
 * Returns true if the signature is valid and auth_date is within 1 hour.
 */
export function verifyTelegramAuth(data: TelegramAuthData, botToken: string): boolean {
  const { hash, ...fields } = data;

  // Build sorted key=value string
  const checkString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  // Key is SHA256 of the bot token
  const secretKey = createHash('sha256').update(botToken).digest();
  const expectedHash = createHmac('sha256', secretKey).update(checkString).digest('hex');

  if (expectedHash !== hash) return false;

  // Reject stale auth (older than 1 hour)
  const authDate = parseInt(data.auth_date, 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 3600) return false;

  return true;
}

export type InlineButton = { text: string; url?: string; callback_data?: string };
export type TelegramResult<T> = { ok: true; result: T } | { ok: false; uncertain: boolean; unchanged?: boolean; missing?: boolean };
/** Never retry a send automatically: a timeout can happen after Telegram accepted it. */
export async function telegramCall<T>(method: string, payload: Record<string, unknown>): Promise<TelegramResult<T>> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, uncertain: false };
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(2000), body: JSON.stringify(payload),
    });
    const value = await response.json() as { ok?: boolean; result?: T; description?: string };
    if (response.ok && value.ok === true && value.result !== undefined) return { ok: true, result: value.result };
    const knownRejection = value.ok === false;
    return { ok: false, uncertain: !knownRejection, unchanged: value.description?.includes('message is not modified'), missing: value.description?.includes('message to edit not found') };
  } catch {
    console.warn('Telegram request failed: network error or timeout');
    return { ok: false, uncertain: true };
  }
}
export function telegramWebhookSecret(token = process.env.TELEGRAM_BOT_TOKEN ?? ''): string {
  return createHmac('sha256', token).update('kittens-setlist:telegram-webhook:v1').digest('hex');
}
export async function sendBotMessage(chatId: string, text: string, buttons: InlineButton[][], entities: BoldEntity[] = []): Promise<TelegramResult<{ message_id: number }>> {
  // Telegram messages are capped at 4096 Unicode characters. Keep complete lines
  // within a conservative UTF-16 limit; the link always opens the full plan.
  const retained = text.length <= 3900 ? text : text.slice(0, 3800).split('\n').slice(0, -1).join('\n');
  const clipped = text.length <= 3900 ? text : `${retained}\n\nПолный список — по ссылке ниже.`;
  const result = await telegramCall<{ message_id: number }>('sendMessage', { chat_id: chatId, text: clipped, entities: entities.filter(entity => entity.offset + entity.length <= retained.length), link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: buttons } });
  if (result.ok && (!Number.isSafeInteger(result.result?.message_id) || result.result.message_id <= 0)) return { ok: false, uncertain: true };
  return result;
}
