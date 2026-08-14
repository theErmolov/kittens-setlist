import type { SetlistEntry, SetlistSubset } from './types';

export type SetlistLayoutItem =
  | { kind: 'subset'; subset: SetlistSubset; entries: SetlistEntry[] }
  | { kind: 'entry'; entry: SetlistEntry };

function entryKey(entry: SetlistEntry): string {
  return entry.songId ?? `break-${entry.order}`;
}

function findEntryLocation(layout: SetlistLayoutItem[], key: string) {
  for (let layoutIndex = 0; layoutIndex < layout.length; layoutIndex++) {
    const item = layout[layoutIndex];
    if (item.kind === 'entry' && entryKey(item.entry) === key) {
      return { layoutIndex, memberIndex: -1, item };
    }
    if (item.kind === 'subset') {
      const memberIndex = item.entries.findIndex(entry => entryKey(entry) === key);
      if (memberIndex >= 0) return { layoutIndex, memberIndex, item };
    }
  }
  return null;
}

function byOrder<T extends { order: number }>(a: T, b: T): number {
  return a.order - b.order;
}

/**
 * Builds the visual editor layout without mutating persisted data.
 *
 * Legacy setlists have no subset header orders. Their established rendering is
 * preserved: subset blocks follow the subsets array, then the unassigned pool.
 */
export function buildSetlistLayout(
  entries: SetlistEntry[],
  subsets: SetlistSubset[],
): SetlistLayoutItem[] {
  const sortedEntries = [...entries].sort(byOrder);
  const knownSubsetIds = new Set(subsets.map(subset => subset.id));
  const members = new Map<string, SetlistEntry[]>();

  for (const subset of subsets) members.set(subset.id, []);
  for (const entry of sortedEntries) {
    if (entry.songId && entry.subsetId && knownSubsetIds.has(entry.subsetId)) {
      members.get(entry.subsetId)!.push(entry);
    }
  }

  const standalone = sortedEntries.filter(entry =>
    !entry.songId || !entry.subsetId || !knownSubsetIds.has(entry.subsetId)
  );

  if (subsets.some(subset => subset.order === undefined)) {
    return [
      ...subsets.map(subset => ({
        kind: 'subset' as const,
        subset,
        entries: members.get(subset.id) ?? [],
      })),
      ...standalone.map(entry => ({ kind: 'entry' as const, entry })),
    ];
  }

  const tokens: Array<
    | { kind: 'subset'; order: number; subset: SetlistSubset }
    | { kind: 'entry'; order: number; entry: SetlistEntry }
  > = [
    ...subsets.map(subset => ({ kind: 'subset' as const, order: subset.order!, subset })),
    ...standalone.map(entry => ({ kind: 'entry' as const, order: entry.order, entry })),
  ];

  tokens.sort((a, b) => a.order - b.order || (a.kind === 'subset' ? -1 : 1));
  return tokens.map(token => token.kind === 'subset'
    ? { kind: 'subset', subset: token.subset, entries: members.get(token.subset.id) ?? [] }
    : { kind: 'entry', entry: token.entry }
  );
}

/** Assigns consecutive positions to subset headers and entries in visual order. */
export function normalizeSetlistLayout(layout: SetlistLayoutItem[]): {
  entries: SetlistEntry[];
  subsets: SetlistSubset[];
} {
  const entries: SetlistEntry[] = [];
  const subsets: SetlistSubset[] = [];
  let order = 0;

  for (const item of layout) {
    if (item.kind === 'subset') {
      subsets.push({ ...item.subset, name: item.subset.name.trim(), order: order++ });
      for (const entry of item.entries) {
        entries.push({ ...entry, subsetId: item.subset.id, order: order++ });
      }
      continue;
    }

    const { subsetId: _subsetId, ...entry } = item.entry;
    entries.push({ ...entry, order: order++ });
  }

  return { entries, subsets };
}

/** Reorders whole subset blocks while leaving every non-subset gap in place. */
export function moveSubsetBlock(
  layout: SetlistLayoutItem[],
  subsetId: string,
  targetSubsetId: string,
): SetlistLayoutItem[] {
  if (subsetId === targetSubsetId) return layout;
  const blocks = layout.filter((item): item is Extract<SetlistLayoutItem, { kind: 'subset' }> => item.kind === 'subset');
  const from = blocks.findIndex(item => item.subset.id === subsetId);
  const to = blocks.findIndex(item => item.subset.id === targetSubsetId);
  if (from < 0 || to < 0) return layout;

  const reordered = [...blocks];
  const [block] = reordered.splice(from, 1);
  reordered.splice(to, 0, block);
  let blockIndex = 0;
  return layout.map(item => item.kind === 'subset' ? reordered[blockIndex++] : item);
}

export function moveSubsetBlockBy(
  layout: SetlistLayoutItem[],
  subsetId: string,
  delta: -1 | 1,
): SetlistLayoutItem[] {
  const blocks = layout.filter((item): item is Extract<SetlistLayoutItem, { kind: 'subset' }> => item.kind === 'subset');
  const from = blocks.findIndex(item => item.subset.id === subsetId);
  const target = from + delta;
  if (from < 0 || target < 0 || target >= blocks.length) return layout;
  return moveSubsetBlock(layout, subsetId, blocks[target].subset.id);
}

/**
 * Moves a song or pause. Songs dropped on a subset member join that subset;
 * pauses dropped there snap to the nearer edge of the complete block.
 */
export function moveLayoutEntry(
  input: SetlistLayoutItem[],
  sourceKey: string,
  targetKey: string | 'end',
  side: 'before' | 'after',
): SetlistLayoutItem[] {
  if (sourceKey === targetKey) return input;
  const layout = input.map(item => item.kind === 'subset'
    ? { ...item, subset: { ...item.subset }, entries: [...item.entries] }
    : { ...item }
  );
  const sourceLocation = findEntryLocation(layout, sourceKey);
  if (!sourceLocation) return input;

  let sourceEntry: SetlistEntry | null = null;
  if (sourceLocation.memberIndex >= 0 && sourceLocation.item.kind === 'subset') {
    sourceEntry = sourceLocation.item.entries.splice(sourceLocation.memberIndex, 1)[0];
  } else if (sourceLocation.item.kind === 'entry') {
    sourceEntry = sourceLocation.item.entry;
    layout.splice(sourceLocation.layoutIndex, 1);
  }
  if (!sourceEntry) return input;

  if (targetKey === 'end') {
    layout.push({ kind: 'entry', entry: sourceEntry });
    return layout;
  }

  const targetLocation = findEntryLocation(layout, targetKey);
  if (!targetLocation) return input;
  if (targetLocation.item.kind === 'subset') {
    const insertionPoint = targetLocation.memberIndex + (side === 'after' ? 1 : 0);
    if (sourceEntry.breakMinutes !== undefined) {
      const afterBlock = insertionPoint > targetLocation.item.entries.length / 2;
      layout.splice(targetLocation.layoutIndex + (afterBlock ? 1 : 0), 0, { kind: 'entry', entry: sourceEntry });
    } else {
      targetLocation.item.entries.splice(insertionPoint, 0, sourceEntry);
      targetLocation.item.subset = { ...targetLocation.item.subset, manualSort: true };
    }
    return layout;
  }

  const lastSubsetIndex = layout.findLastIndex(item => item.kind === 'subset');
  let insertionIndex = targetLocation.layoutIndex + (side === 'after' ? 1 : 0);
  if (sourceEntry.songId && insertionIndex <= lastSubsetIndex) insertionIndex = lastSubsetIndex + 1;
  layout.splice(insertionIndex, 0, { kind: 'entry', entry: sourceEntry });
  return layout;
}

/** Handles dropping onto a subset header, including empty subsets. */
export function moveLayoutEntryToSubset(
  input: SetlistLayoutItem[],
  sourceKey: string,
  subsetId: string,
  side: 'before' | 'after',
): SetlistLayoutItem[] {
  const layout = input.map(item => item.kind === 'subset'
    ? { ...item, subset: { ...item.subset }, entries: [...item.entries] }
    : { ...item }
  );
  const sourceLocation = findEntryLocation(layout, sourceKey);
  if (!sourceLocation) return input;

  let sourceEntry: SetlistEntry | null = null;
  if (sourceLocation.memberIndex >= 0 && sourceLocation.item.kind === 'subset') {
    sourceEntry = sourceLocation.item.entries.splice(sourceLocation.memberIndex, 1)[0];
  } else if (sourceLocation.item.kind === 'entry') {
    sourceEntry = sourceLocation.item.entry;
    layout.splice(sourceLocation.layoutIndex, 1);
  }
  if (!sourceEntry) return input;

  const targetIndex = layout.findIndex(item => item.kind === 'subset' && item.subset.id === subsetId);
  if (targetIndex < 0) return input;
  const target = layout[targetIndex];
  if (target.kind !== 'subset') return input;

  if (sourceEntry.breakMinutes !== undefined) {
    layout.splice(targetIndex + (side === 'after' ? 1 : 0), 0, { kind: 'entry', entry: sourceEntry });
  } else {
    target.entries.push(sourceEntry);
    target.subset = { ...target.subset, manualSort: true };
  }
  return layout;
}
