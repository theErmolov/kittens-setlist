import { createHmac, createHash } from 'crypto';
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
