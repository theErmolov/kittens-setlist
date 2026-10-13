export interface NotificationEntity { type: 'bold' | 'blockquote'; offset: number; length: number }
export interface NotificationText { text: string; entities: NotificationEntity[] }
interface NotificationSong { artist: string; title: string; note?: string }

/** Plain text + UTF-16 entities avoid treating song titles or notes as markup. */
export function songListText(songs: NotificationSong[]): NotificationText {
  const result: NotificationText = { text: '', entities: [] };
  const sorted = [...songs].sort((a, b) => a.artist.localeCompare(b.artist, 'en', { sensitivity: 'base' }) || a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
  for (const song of sorted) {
    if (result.text) result.text += '\n';
    result.text += `• ${song.artist} — `;
    if (song.title) result.entities.push({ type: 'bold', offset: result.text.length, length: song.title.length });
    result.text += song.title;
    if (song.note) result.text += `\n  ${song.note}`;
  }
  if (result.text.trimEnd()) result.entities.unshift({ type: 'blockquote', offset: 0, length: result.text.trimEnd().length });
  return result;
}
export function appendNotificationText(target: NotificationText, part: NotificationText): void {
  target.entities.push(...part.entities.map(entity => ({ ...entity, offset: entity.offset + target.text.length })));
  target.text += part.text;
}
