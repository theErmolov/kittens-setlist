import type { User } from './types.js';
import type { InlineButton } from './telegram.js';

export const personalLink = (user: User, rehearsalId: string): InlineButton => user.isAdmin || user.role === 'writer'
  ? { text: 'Открыть репетицию', url: `https://kittens.band/rehearsals/${encodeURIComponent(rehearsalId)}` }
  : { text: 'Открыть каталог', url: 'https://kittens.band/backlog' };
export const personalButtons = (enabled: boolean, rehearsalId: string, user: User): InlineButton[][] => [[personalLink(user, rehearsalId)], [{ text: enabled ? 'Отключить напоминания' : 'Включить напоминания', callback_data: enabled ? 'notify:stop' : 'notify:resume' }]];
