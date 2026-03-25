import { createHmac, createHash } from 'crypto';

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
