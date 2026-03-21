// Mirrors src/lib/types.ts — keep in sync

export type Category = 'top' | 'mid' | 'low';
export type Instrument = 'guitar' | 'bass' | 'drums' | 'keys' | 'percussion' | 'violin' | 'maracas' | 'vocals';

export interface MusicianRole {
  instruments: Instrument[];  // empty = free
}

export interface BandMusician {
  id: string;
  name: string;
  defaultInstrument?: Instrument;
  sortOrder?: number;
  guest?: boolean;
}

export interface Song {
  id: string;
  artist: string;
  title: string;
  category: Category;
  comment?: string;  // general note, copied to setlist entry on add
  musicians: Record<string, MusicianRole>;
  sortOrder?: number;
}

export interface SetlistEntry {
  songId?: string;
  song?: Song;
  breakMinutes?: number;
  order: number;
  played: boolean;
  comment?: string;
}

export interface Setlist {
  id: string;
  name: string;
  date?: string;
  startTime?: string;
  entries: SetlistEntry[];
}
