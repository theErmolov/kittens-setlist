// Mirrors src/lib/types.ts — keep in sync

export type Category = 'top' | 'mid' | 'low';
export type Instrument = 'guitar' | 'bass' | 'drums' | 'keys' | 'percussion' | 'violin';

export interface MusicianRole {
  instrument?: Instrument;
  vocals: boolean;
}

export interface BandMusician {
  id: string;
  name: string;
  defaultInstrument?: Instrument;
  sortOrder?: number;
}

export interface Song {
  id: string;
  artist: string;
  title: string;
  category: Category;
  comment?: string;
  musicians: Record<string, MusicianRole>;
  extraMusicians?: string;
  sortOrder?: number;
}

export interface SetlistEntry {
  songId?: string;
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
