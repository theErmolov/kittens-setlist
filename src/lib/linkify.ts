/** Splits free text into plain-text and link parts; links are shown as «second-level.top-level» (https://www.youtube.com/x → youtube.com). */
export type TextPart = { type: 'text'; text: string } | { type: 'link'; text: string; href: string };

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING = /[.,;:!?)\]}»]+$/;

/** `youtube.com` for `https://www.youtube.com/watch?v=1`; IPs and single-label hosts are kept whole. */
export function linkLabel(href: string): string {
  try {
    const host = new URL(href).hostname.replace(/^www\./i, '');
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || !host.includes('.')) return host;
    return host.split('.').slice(-2).join('.');
  } catch {
    return href;
  }
}

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    let url = match[0];
    const trail = url.match(TRAILING)?.[0] ?? '';
    if (trail) url = url.slice(0, -trail.length);
    const start = match.index ?? 0;
    if (start > last) parts.push({ type: 'text', text: text.slice(last, start) });
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    parts.push({ type: 'link', text: linkLabel(href), href });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) });
  return parts;
}
