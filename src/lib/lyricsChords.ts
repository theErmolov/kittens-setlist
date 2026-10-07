export const CHORD_TOKEN_RE = /^[A-G][b#]?(?:m(?:aj\d*)?|sus[24]?|aug|dim|\d+(?:add\d+)?)*(?:\/[A-G][b#]?)?$/;
const ANNOTATION_TOKEN_RE = /^(?:[{}\[\]()|]*[xх×]\d+[{}\[\]()|]*|[{}\[\]()|]+|[+-]\d+)$/iu;
const SECTION_PREFIX_RE = /^\s*(?:Кода|Вступление|Припев|Куплет|Бридж|Проигрыш|Финал|Intro|Verse|Chorus|Bridge|Solo|Outro|Coda)(?:\s+\d+)?\s*:\s*/iu;
const CHORD_SOURCE = /[A-G][b#]?(?:m(?:aj\d*)?|sus[24]?|aug|dim|\d+(?:add\d+)?)*(?:\/[A-G][b#]?)?/.source;
// Boundaries prevent section labels such as Coda from being transposed as C.
export const CHORD_FIND_SRC = `(?<![A-Za-z])${CHORD_SOURCE}(?![A-Za-z0-9#])`;

export function isChordLine(line: string): boolean {
  const body = line.replace(SECTION_PREFIX_RE, '');
  const tokens = body.trim().split(/\s+/).filter(Boolean);
  const isChord = (token: string) => CHORD_TOKEN_RE.test(token.replace(/^[{\[()|]+|[}\])|]+$/g, ''));
  return tokens.length > 0 && tokens.some(isChord)
    && tokens.every(token => isChord(token) || ANNOTATION_TOKEN_RE.test(token));
}

export function firstChord(line: string): string {
  if (!isChordLine(line)) return '';
  return line.replace(SECTION_PREFIX_RE, '').match(new RegExp(CHORD_FIND_SRC))?.[0] ?? '';
}
