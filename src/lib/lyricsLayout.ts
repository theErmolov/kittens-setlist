export interface LyricsPair {
  chordLine: string | null;
  lyricLine: string;
}

/** Pack by actual line height, keeping each chord together with its lyric. */
export function packLyricsColumns(pairs: LyricsPair[], lineHeight: number, maxHeight: number): LyricsPair[][] {
  const columns: LyricsPair[][] = [];
  let column: LyricsPair[] = [];
  let height = 0;
  for (const pair of pairs) {
    const pairHeight = (pair.chordLine !== null ? 2 : 1) * lineHeight;
    if (column.length && height + pairHeight > maxHeight) {
      columns.push(column);
      column = [];
      height = 0;
    }
    column.push(pair);
    height += pairHeight;
  }
  if (column.length) columns.push(column);
  return columns.length ? columns : [[]];
}
