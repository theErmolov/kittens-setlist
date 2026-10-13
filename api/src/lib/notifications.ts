import { getUserByTelegramId } from './people.js';
import { sendUserNotification } from './telegram.js';
import type { User } from './types.js';

/** The first notification type; other events can reuse sendUserNotification. */
export async function notifyAuthenticationRequest(user: User): Promise<void> {
  const recipientId = process.env.AUTH_APPROVAL_TELEGRAM_ID;
  if (!recipientId) return;

  try {
    const recipient = await getUserByTelegramId(recipientId);
    if (!recipient?.isAdmin) return;
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.telegramId;
    const username = user.username ? ` (@${user.username})` : '';
    await sendUserNotification(recipient, {
      text: `Новая заявка на доступ к Музыкальным Котяткам.\n\n${name}${username}\n\nОдобрите или отклоните заявку в разделе пользователей.`,
      button: { text: 'Открыть пользователей', url: 'https://kittens.band/admin' },
    });
  } catch {
    console.warn('Authentication notification failed: could not resolve recipient');
  }
}
